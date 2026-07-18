const { pool } = require('../config/supabase');

async function offerRide(req, res) {
  const { 
    vehicleId, 
    pickupLocation, 
    destination, 
    departureDate, 
    departureTime, 
    availableSeats, 
    farePerSeat,
    pickupLat,
    pickupLon,
    destinationLat,
    destinationLon
  } = req.body;
  const driverId = req.user.id;
  const organizationId = req.user.organization_id;

  if (!vehicleId || !pickupLocation || !destination || !departureDate || !departureTime || !availableSeats || farePerSeat === undefined) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Validate offered seats against vehicle capacity
    const vehicleRes = await pool.query('SELECT capacity FROM vehicles WHERE id = $1 AND user_id = $2', [vehicleId, driverId]);
    if (vehicleRes.rows.length === 0) {
      return res.status(400).json({ error: 'Selected vehicle not found or not registered to you.' });
    }
    const vehicle = vehicleRes.rows[0];
    if (parseInt(availableSeats) > vehicle.capacity) {
      return res.status(400).json({ error: `Offered seats (${availableSeats}) cannot exceed the vehicle capacity (${vehicle.capacity} seats).` });
    }

    const result = await pool.query(`
      INSERT INTO rides (
        driver_id, vehicle_id, organization_id, pickup_location, destination, 
        departure_date, departure_time, available_seats, fare_per_seat,
        pickup_lat, pickup_lon, destination_lat, destination_lon
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, pickup_location, destination, departure_date, departure_time, available_seats, fare_per_seat
    `, [
      driverId, vehicleId, organizationId, pickupLocation, destination, 
      departureDate, departureTime, availableSeats, farePerSeat,
      pickupLat || null, pickupLon || null, destinationLat || null, destinationLon || null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error offering ride:', error);
    res.status(500).json({ error: 'Failed to offer ride' });
  }
}

async function searchRides(req, res) {
  const organizationId = req.user.organization_id;
  
  try {
    const result = await pool.query(`
      SELECT r.id, r.pickup_location, r.destination, r.departure_date, r.departure_time, r.available_seats, r.fare_per_seat, r.pickup_lat, r.pickup_lon, r.destination_lat, r.destination_lon,
             u.full_name as driver_name, u.phone as driver_phone, v.make_model as vehicle_make, v.license_plate as vehicle_license_plate
      FROM rides r
      INNER JOIN users u ON r.driver_id = u.id
      INNER JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.organization_id = $1 
        AND r.status = 'Open' 
        AND r.available_seats > 0
        AND r.driver_id != $2
        AND r.id NOT IN (SELECT ride_id FROM bookings WHERE passenger_id = $2)
      ORDER BY r.departure_date ASC, r.departure_time ASC
    `, [organizationId, req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error searching rides:', error);
    res.status(500).json({ error: 'Failed to search rides' });
  }
}

async function bookRide(req, res) {
  const { 
    rideId, 
    seats,
    pickupLocation,
    pickupLat,
    pickupLon,
    distanceKm,
    fare
  } = req.body;
  const passengerId = req.user.id;
  const seatsToBook = parseInt(seats) || 1;

  try {
    await pool.query('BEGIN');
    
    // Check ride availability
    const rideCheck = await pool.query(`
      SELECT * FROM rides WHERE id = $1 AND status = 'Open' AND available_seats >= $2 FOR UPDATE
    `, [rideId, seatsToBook]);

    if (rideCheck.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'Ride is no longer available or not enough seats' });
    }

    const ride = rideCheck.rows[0];

    // Create booking request (status is 'Requested' by default)
    await pool.query(`
      INSERT INTO bookings (
        ride_id, passenger_id, seats_booked, status, 
        pickup_location, pickup_lat, pickup_lon, distance_km, fare
      )
      VALUES ($1, $2, $3, 'Requested', $4, $5, $6, $7, $8)
    `, [
      rideId, 
      passengerId, 
      seatsToBook, 
      pickupLocation || ride.pickup_location,
      pickupLat !== undefined ? pickupLat : ride.pickup_lat,
      pickupLon !== undefined ? pickupLon : ride.pickup_lon,
      distanceKm || null,
      fare || null
    ]);

    // Note: available_seats are NOT updated here. They will only be updated
    // when the driver approves the request.

    await pool.query('COMMIT');
    res.status(201).json({ message: 'Ride booking request sent successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error booking ride:', error);
    res.status(500).json({ error: 'Failed to book ride' });
  }
}

async function getRideHistory(req, res) {
  const userId = req.user.id;

  try {
    // Rides where user is driver
    const drivenRidesRes = await pool.query(`
      SELECT r.id, r.pickup_location, r.destination, r.departure_date, r.departure_time, r.available_seats, r.fare_per_seat, r.status, r.cancellation_reason, r.pickup_lat, r.pickup_lon, r.destination_lat, r.destination_lon,
             'Driver' as user_role, v.make_model as vehicle_make, v.license_plate as vehicle_license_plate
      FROM rides r
      INNER JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.driver_id = $1
      ORDER BY r.departure_date DESC, r.departure_time DESC
    `, [userId]);

    const drivenRides = drivenRidesRes.rows;
    for (let ride of drivenRides) {
      const bookings = await pool.query(`
        SELECT b.id, b.ride_id, b.passenger_id, b.seats_booked, b.status, b.pickup_location, b.pickup_lat, b.pickup_lon, b.distance_km, b.fare, b.cancellation_reason,
               b.payment_status, b.payment_method,
               u.full_name as passenger_name, u.phone as passenger_phone
        FROM bookings b
        INNER JOIN users u ON b.passenger_id = u.id
        WHERE b.ride_id = $1
        ORDER BY b.created_at ASC
      `, [ride.id]);
      ride.bookings = bookings.rows;
    }

    // Rides where user is passenger
    const passengerRidesRes = await pool.query(`
      SELECT r.id, r.pickup_location, r.destination, r.departure_date, r.departure_time, r.fare_per_seat, r.status, 
             r.pickup_lat, r.pickup_lon, r.destination_lat, r.destination_lon,
             'Passenger' as user_role, u.full_name as driver_name, u.phone as driver_phone, 
             v.make_model as vehicle_make, v.license_plate as vehicle_license_plate,
             b.seats_booked, b.status as booking_status, b.pickup_location as my_pickup_location, 
             b.pickup_lat as my_pickup_lat, b.pickup_lon as my_pickup_lon, 
             b.distance_km as my_distance_km, b.fare as my_fare, b.id as booking_id, b.cancellation_reason,
             b.payment_status, b.payment_method
      FROM bookings b
      INNER JOIN rides r ON b.ride_id = r.id
      INNER JOIN users u ON r.driver_id = u.id
      INNER JOIN vehicles v ON r.vehicle_id = v.id
      WHERE b.passenger_id = $1
      ORDER BY r.departure_date DESC, r.departure_time DESC
    `, [userId]);

    const passengerRides = passengerRidesRes.rows;
    for (let ride of passengerRides) {
      // Fetch all other confirmed riders for this ride
      const otherRidersRes = await pool.query(`
        SELECT b.seats_booked, b.pickup_location, b.pickup_lat, b.pickup_lon, u.full_name as passenger_name
        FROM bookings b
        INNER JOIN users u ON b.passenger_id = u.id
        WHERE b.ride_id = $1 AND b.status = 'Confirmed' AND b.passenger_id != $2
      `, [ride.id, userId]);
      ride.other_riders = otherRidersRes.rows;
    }

    const allRides = [...drivenRides, ...passengerRides];
    
    // Sort combined by date
    allRides.sort((a, b) => {
      const dateA = new Date(a.departure_date + 'T' + a.departure_time);
      const dateB = new Date(b.departure_date + 'T' + b.departure_time);
      return dateB - dateA;
    });

    res.json(allRides);
  } catch (error) {
    console.error('Error fetching ride history:', error);
    res.status(500).json({ error: 'Failed to fetch ride history' });
  }
}
async function completeOrDeleteRide(req, res) {
  const { id } = req.params;
  const { action, reason } = req.body; // 'Complete' or 'Delete'
  const driverId = req.user.id;

  try {
    // Verify driver owns the ride
    const check = await pool.query('SELECT * FROM rides WHERE id = $1 AND driver_id = $2', [id, driverId]);
    if (check.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized to modify this ride' });
    }

    if (action === 'Delete') {
      await pool.query("UPDATE rides SET status = 'Cancelled', cancellation_reason = $1 WHERE id = $2", [reason || '', id]);
      res.json({ message: 'Ride cancelled successfully' });
    } else if (action === 'Complete') {
      await pool.query("UPDATE rides SET status = 'Completed' WHERE id = $1", [id]);
      res.json({ message: 'Ride marked as completed' });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error modifying ride:', error);
    res.status(500).json({ error: 'Failed to modify ride' });
  }
}

async function updateBookingStatus(req, res) {
  const { bookingId } = req.params;
  const { status, reason } = req.body; // 'Confirmed', 'Declined', or 'Cancelled'
  const userId = req.user.id;

  if (!['Confirmed', 'Declined', 'Cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be Confirmed, Declined, or Cancelled.' });
  }

  try {
    await pool.query('BEGIN');

    // 1. Get the booking and join ride to verify driver/passenger ownership
    const bookingRes = await pool.query(`
      SELECT b.*, r.driver_id, r.available_seats, r.status as ride_status
      FROM bookings b
      JOIN rides r ON b.ride_id = r.id
      WHERE b.id = $1 FOR UPDATE
    `, [bookingId]);

    if (bookingRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking request not found' });
    }

    const booking = bookingRes.rows[0];

    // Authorization check
    if (status === 'Cancelled') {
      // Passenger cancels
      if (booking.passenger_id !== userId) {
        await pool.query('ROLLBACK');
        return res.status(403).json({ error: 'Unauthorized. Only the passenger can cancel this request.' });
      }
    } else {
      // Driver confirms or declines
      if (booking.driver_id !== userId) {
        await pool.query('ROLLBACK');
        return res.status(403).json({ error: 'Unauthorized. Only the driver of this ride can update request status.' });
      }

      if (booking.status !== 'Requested') {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: `Booking has already been ${booking.status.toLowerCase()}` });
      }
    }

    // Process status updates
    if (status === 'Confirmed') {
      if (booking.ride_status !== 'Open') {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'Ride is no longer open' });
      }

      if (booking.available_seats < booking.seats_booked) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'Not enough available seats in the ride' });
      }

      // Update ride available seats
      await pool.query(`
        UPDATE rides 
        SET available_seats = available_seats - $1 
        WHERE id = $2
      `, [booking.seats_booked, booking.ride_id]);
    } else if (status === 'Cancelled' && booking.status === 'Confirmed') {
      // Release seats back to driver if it was already confirmed
      await pool.query(`
        UPDATE rides 
        SET available_seats = available_seats + $1 
        WHERE id = $2
      `, [booking.seats_booked, booking.ride_id]);
    }

    // Update booking status and reason
    await pool.query(`
      UPDATE bookings 
      SET status = $1, cancellation_reason = $2
      WHERE id = $3
    `, [status, reason || '', bookingId]);

    await pool.query('COMMIT');
    res.json({ message: `Request successfully ${status.toLowerCase()}` });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating booking status:', error);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
}


async function startRide(req, res) {
  const { id } = req.params;
  const driverId = req.user.id;
  try {
    const check = await pool.query('SELECT * FROM rides WHERE id = $1 AND driver_id = $2', [id, driverId]);
    if (check.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized to modify this ride' });
    }
    if (check.rows[0].status !== 'Open') {
      return res.status(400).json({ error: `Cannot start a ride that is already "${check.rows[0].status}"` });
    }
    await pool.query("UPDATE rides SET status = 'In Progress' WHERE id = $1", [id]);
    res.json({ message: 'Ride started successfully' });
  } catch (error) {
    console.error('Error starting ride:', error);
    res.status(500).json({ error: 'Failed to start ride' });
  }
}

module.exports = {
  offerRide,
  searchRides,
  bookRide,
  getRideHistory,
  completeOrDeleteRide,
  updateBookingStatus,
  startRide
};
