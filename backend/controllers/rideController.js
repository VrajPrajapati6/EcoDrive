const { pool } = require('../config/supabase');

async function offerRide(req, res) {
  const { vehicleId, pickupLocation, destination, departureDate, departureTime, availableSeats, farePerSeat } = req.body;
  const driverId = req.user.id;
  const organizationId = req.user.organization_id;

  if (!vehicleId || !pickupLocation || !destination || !departureDate || !departureTime || !availableSeats || farePerSeat === undefined) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO rides (driver_id, vehicle_id, organization_id, pickup_location, destination, departure_date, departure_time, available_seats, fare_per_seat)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [driverId, vehicleId, organizationId, pickupLocation, destination, departureDate, departureTime, availableSeats, farePerSeat]);

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
      SELECT r.*, u.full_name as driver_name, u.phone as driver_phone, v.make_model as vehicle_make
      FROM rides r
      JOIN users u ON r.driver_id = u.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.organization_id = $1 
        AND r.status = 'Open' 
        AND r.available_seats > 0
        AND r.driver_id != $2
      ORDER BY r.departure_date ASC, r.departure_time ASC
    `, [organizationId, req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error searching rides:', error);
    res.status(500).json({ error: 'Failed to search rides' });
  }
}

async function bookRide(req, res) {
  const { rideId, seats } = req.body;
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

    // Create booking
    await pool.query(`
      INSERT INTO bookings (ride_id, passenger_id, seats_booked)
      VALUES ($1, $2, $3)
    `, [rideId, passengerId, seatsToBook]);

    // Update ride seats
    await pool.query(`
      UPDATE rides SET available_seats = available_seats - $2 WHERE id = $1
    `, [rideId, seatsToBook]);

    await pool.query('COMMIT');
    res.status(201).json({ message: 'Ride booked successfully' });
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
      SELECT r.*, 'Driver' as user_role, v.make_model as vehicle_make
      FROM rides r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.driver_id = $1
      ORDER BY r.departure_date DESC, r.departure_time DESC
    `, [userId]);

    // Rides where user is passenger
    const passengerRidesRes = await pool.query(`
      SELECT r.*, 'Passenger' as user_role, u.full_name as driver_name, b.seats_booked, b.status as booking_status
      FROM bookings b
      JOIN rides r ON b.ride_id = r.id
      JOIN users u ON r.driver_id = u.id
      WHERE b.passenger_id = $1
      ORDER BY r.departure_date DESC, r.departure_time DESC
    `, [userId]);

    const allRides = [...drivenRidesRes.rows, ...passengerRidesRes.rows];
    
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
  const { action } = req.body; // 'Complete' or 'Delete/Cancel'
  const driverId = req.user.id;

  try {
    // Verify driver owns the ride
    const check = await pool.query('SELECT * FROM rides WHERE id = $1 AND driver_id = $2', [id, driverId]);
    if (check.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized to modify this ride' });
    }

    if (action === 'Delete') {
      await pool.query('DELETE FROM rides WHERE id = $1', [id]);
      res.json({ message: 'Ride deleted successfully' });
    } else if (action === 'Complete') {
      await pool.query('UPDATE rides SET status = $1 WHERE id = $2', ['Completed', id]);
      res.json({ message: 'Ride marked as completed' });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error modifying ride:', error);
    res.status(500).json({ error: 'Failed to modify ride' });
  }
}

module.exports = {
  offerRide,
  searchRides,
  bookRide,
  getRideHistory,
  completeOrDeleteRide
};
