const { pool } = require('../config/supabase');

async function getOrganizationRidesReport(req, res) {
  const organizationId = req.user.organization_id;
  
  if (req.user.role !== 'Company Administrator') {
    return res.status(403).json({ error: 'Unauthorized access. Admins only.' });
  }

  try {
    const result = await pool.query(`
      SELECT r.id, r.pickup_location, r.destination, r.departure_date, r.departure_time, 
             r.available_seats, r.fare_per_seat, r.status,
             u.full_name as driver_name, u.email as driver_email,
             v.make_model as vehicle_make, v.license_plate
      FROM rides r
      JOIN users u ON r.driver_id = u.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.organization_id = $1
      ORDER BY r.departure_date DESC, r.departure_time DESC
    `, [organizationId]);

    // Also get bookings per ride for richer reports
    const rideIds = result.rows.map(r => r.id);
    let bookings = [];
    if (rideIds.length > 0) {
      const bookingsRes = await pool.query(`
        SELECT b.ride_id, sum(b.seats_booked) as total_booked
        FROM bookings b
        WHERE b.ride_id = ANY($1)
        GROUP BY b.ride_id
      `, [rideIds]);
      bookings = bookingsRes.rows;
    }

    const report = result.rows.map(ride => {
      const bookingData = bookings.find(b => b.ride_id === ride.id);
      return {
        ...ride,
        total_booked: bookingData ? parseInt(bookingData.total_booked) : 0
      };
    });

    res.json(report);
  } catch (error) {
    console.error('Error fetching admin reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
}

module.exports = {
  getOrganizationRidesReport
};
