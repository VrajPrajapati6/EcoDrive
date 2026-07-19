const fs = require('fs');
const path = 'c:/Users/Prince/OneDrive/Documents/Hackathon/ODOO/backend/controllers/rideController.js';
let content = fs.readFileSync(path, 'utf8');

const newFunctions = `
async function createRecurringRequest(req, res) {
  const { pickupLocation, pickupLat, pickupLon, destination, destinationLat, destinationLon, departureTime, days, seatsNeeded } = req.body;
  const passengerId = req.user.id;
  const organizationId = req.user.organization_id;
  
  if (!pickupLocation || !destination || !departureTime || !days || !days.length) {
    return res.status(400).json({ error: 'All fields are required for recurring requests' });
  }
  
  try {
    const result = await pool.query(
      "INSERT INTO recurring_requests (passenger_id, organization_id, pickup_location, pickup_lat, pickup_lon, destination, destination_lat, destination_lon, departure_time, days, seats_needed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *",
      [passengerId, organizationId, pickupLocation, pickupLat || null, pickupLon || null, destination, destinationLat || null, destinationLon || null, departureTime, JSON.stringify(days), seatsNeeded || 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating recurring request:', error);
    res.status(500).json({ error: 'Failed to create recurring request' });
  }
}

async function getRecurringRequests(req, res) {
  const userId = req.user.id;
  const organizationId = req.user.organization_id;
  
  try {
    const result = await pool.query(
      "SELECT r.*, u.full_name as passenger_name, u.phone as passenger_phone FROM recurring_requests r JOIN users u ON r.passenger_id = u.id WHERE r.organization_id = $1 AND (r.passenger_id = $2 OR r.status = 'Open' OR (r.status = 'Accepted' AND r.accepted_driver_id = $2)) ORDER BY r.created_at DESC",
      [organizationId, userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recurring requests:', error);
    res.status(500).json({ error: 'Failed to fetch recurring requests' });
  }
}

async function acceptRecurringRequest(req, res) {
  const requestId = req.params.id;
  const driverId = req.user.id;
  
  try {
    const result = await pool.query(
      "UPDATE recurring_requests SET status = 'Accepted', accepted_driver_id = $1 WHERE id = $2 AND status = 'Open' RETURNING *",
      [driverId, requestId]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Request not available' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error accepting recurring request:', error);
    res.status(500).json({ error: 'Failed to accept recurring request' });
  }
}

`;

content = content.replace('module.exports = {', newFunctions + '\nmodule.exports = {');
content = content.replace('module.exports = {\n', 'module.exports = {\n  createRecurringRequest,\n  getRecurringRequests,\n  acceptRecurringRequest,\n');

const autoBookLogic = `
    // Auto-booking for recurring requests
    const dateObj = new Date(departureDate);
    const daysMap = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const dayOfWeek = daysMap[dateObj.getDay()];

    const recurringRes = await pool.query(
      "SELECT * FROM recurring_requests WHERE accepted_driver_id = $1 AND status = 'Accepted' AND departure_time = $2",
      [driverId, departureTime]
    );
    
    let updatedSeats = availableSeats;

    for (let req of recurringRes.rows) {
      if (req.days.includes(dayOfWeek) && updatedSeats >= req.seats_needed) {
        await pool.query(
          "INSERT INTO bookings (ride_id, passenger_id, seats_booked, status, pickup_location, pickup_lat, pickup_lon, distance_km, fare) VALUES ($1, $2, $3, 'Confirmed', $4, $5, $6, null, null)",
          [result.rows[0].id, req.passenger_id, req.seats_needed, req.pickup_location, req.pickup_lat, req.pickup_lon]
        );
        updatedSeats -= req.seats_needed;
      }
    }
    
    if (updatedSeats !== availableSeats) {
      await pool.query('UPDATE rides SET available_seats = $1 WHERE id = $2', [updatedSeats, result.rows[0].id]);
      result.rows[0].available_seats = updatedSeats;
    }
`;

content = content.replace('res.status(201).json(result.rows[0]);', autoBookLogic + '\n    res.status(201).json(result.rows[0]);');

fs.writeFileSync(path, content, 'utf8');
console.log('rideController.js updated successfully.');
