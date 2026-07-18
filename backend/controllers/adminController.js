const { pool } = require('../config/supabase');

async function getOrganizationRidesReport(req, res) {
  const organizationId = req.user.organization_id;
  
  if (req.user.role !== 'Company Administrator') {
    return res.status(403).json({ error: 'Unauthorized access. Admins only.' });
  }

  try {
    const result = await pool.query(`
      SELECT r.id, r.pickup_location, r.destination, r.departure_date, r.departure_time, 
             r.available_seats, r.fare_per_seat, r.status, r.cancellation_reason,
             u.full_name as driver_name, u.email as driver_email,
             v.make_model as vehicle_make, v.license_plate
      FROM rides r
      INNER JOIN users u ON r.driver_id = u.id
      INNER JOIN vehicles v ON r.vehicle_id = v.id
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

async function getOrganizationEmployees(req, res) {
  const organizationId = req.user.organization_id;
  if (req.user.role !== 'Company Administrator') {
    return res.status(403).json({ error: 'Unauthorized access. Admins only.' });
  }
  try {
    const result = await pool.query(`
      SELECT id, email, full_name as "fullName", role, employee_id as "employeeId", phone, is_active as "isActive"
      FROM users
      WHERE organization_id = $1 AND role = 'Employee'
      ORDER BY full_name ASC
    `, [organizationId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching employees:', err);
    res.status(500).json({ error: 'Failed to fetch employees.' });
  }
}

async function toggleEmployeeStatus(req, res) {
  const { employeeId } = req.params;
  const { isActive } = req.body;
  const organizationId = req.user.organization_id;

  if (req.user.role !== 'Company Administrator') {
    return res.status(403).json({ error: 'Unauthorized access. Admins only.' });
  }

  try {
    const result = await pool.query(`
      UPDATE users
      SET is_active = $1
      WHERE id = $2 AND organization_id = $3 AND role = 'Employee'
      RETURNING id, full_name, is_active
    `, [isActive, employeeId, organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found in your organization.' });
    }

    res.json({ message: `Employee successfully ${isActive ? 'activated' : 'deactivated'}.`, employee: result.rows[0] });
  } catch (err) {
    console.error('Error toggling employee status:', err);
    res.status(500).json({ error: 'Failed to update employee status.' });
  }
}

async function getOrganizationVehicles(req, res) {
  const organizationId = req.user.organization_id;
  if (req.user.role !== 'Company Administrator') {
    return res.status(403).json({ error: 'Unauthorized access. Admins only.' });
  }
  try {
    const result = await pool.query(`
      SELECT v.id, v.make_model as "makeModel", v.license_plate as "licensePlate", v.capacity, v.is_approved as "isApproved",
             u.full_name as "driverName", u.email as "driverEmail"
      FROM vehicles v
      INNER JOIN users u ON v.user_id = u.id
      WHERE u.organization_id = $1
      ORDER BY v.created_at DESC
    `, [organizationId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching vehicles:', err);
    res.status(500).json({ error: 'Failed to fetch vehicles.' });
  }
}

async function toggleVehicleApproval(req, res) {
  const { vehicleId } = req.params;
  const { isApproved } = req.body;
  const organizationId = req.user.organization_id;

  if (req.user.role !== 'Company Administrator') {
    return res.status(403).json({ error: 'Unauthorized access. Admins only.' });
  }

  try {
    const result = await pool.query(`
      UPDATE vehicles v
      SET is_approved = $1
      FROM users u
      WHERE v.id = $2 AND v.user_id = u.id AND u.organization_id = $3
      RETURNING v.id, v.is_approved
    `, [isApproved, vehicleId, organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found or unauthorized.' });
    }

    res.json({ message: `Vehicle status successfully updated to ${isApproved ? 'Approved' : 'Inactive'}.`, vehicle: result.rows[0] });
  } catch (err) {
    console.error('Error toggling vehicle status:', err);
    res.status(500).json({ error: 'Failed to update vehicle status.' });
  }
}

async function updateOrganizationSettings(req, res) {
  const organizationId = req.user.organization_id;
  const { name, industry, registeredAddress, adminContact, fuelCost, costPerKm, travelCostOperational } = req.body;

  if (req.user.role !== 'Company Administrator') {
    return res.status(403).json({ error: 'Unauthorized access. Admins only.' });
  }

  try {
    const result = await pool.query(`
      UPDATE organizations
      SET name = COALESCE($1, name),
          industry = COALESCE($2, industry),
          registered_address = COALESCE($3, registered_address),
          admin_contact = COALESCE($4, admin_contact),
          fuel_cost = COALESCE($5, fuel_cost),
          cost_per_km = COALESCE($6, cost_per_km),
          travel_cost_operational = COALESCE($7, travel_cost_operational)
      WHERE id = $8
      RETURNING id, name, industry, registered_address as "registeredAddress", admin_contact as "adminContact", fuel_cost as "fuelCost", cost_per_km as "costPerKm", travel_cost_operational as "travelCostOperational"
    `, [
      name, 
      industry, 
      registeredAddress, 
      adminContact, 
      fuelCost ? parseFloat(fuelCost) : null, 
      costPerKm ? parseFloat(costPerKm) : null, 
      travelCostOperational ? parseFloat(travelCostOperational) : null, 
      organizationId
    ]);

    res.json({ message: 'Settings updated successfully!', organization: result.rows[0] });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
}

const bcrypt = require('bcryptjs');
async function adminAddEmployee(req, res) {
  const { email, password, fullName, employeeId, phone } = req.body;
  const organizationId = req.user.organization_id;

  if (req.user.role !== 'Company Administrator') {
    return res.status(403).json({ error: 'Unauthorized. Admins only.' });
  }

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }

  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Employee with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await pool.query(`
      INSERT INTO users (email, password_hash, full_name, role, organization_id, employee_id, phone, is_active)
      VALUES ($1, $2, $3, 'Employee', $4, $5, $6, true)
      RETURNING id, email, full_name as "fullName", role, employee_id as "employeeId", phone, is_active as "isActive"
    `, [email, passwordHash, fullName, organizationId, employeeId || '', phone || '']);

    res.status(201).json({ message: 'Employee added successfully!', employee: result.rows[0] });
  } catch (err) {
    console.error('Error admin adding employee:', err);
    res.status(500).json({ error: 'Failed to add employee.' });
  }
}

async function adminAddVehicle(req, res) {
  const { makeModel, licensePlate, capacity, userEmail } = req.body;
  const organizationId = req.user.organization_id;

  if (req.user.role !== 'Company Administrator') {
    return res.status(403).json({ error: 'Unauthorized. Admins only.' });
  }

  if (!makeModel || !licensePlate || !capacity || !userEmail) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND organization_id = $2', [userEmail, organizationId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found in your organization.' });
    }
    const driverId = userCheck.rows[0].id;

    const result = await pool.query(`
      INSERT INTO vehicles (user_id, make_model, license_plate, capacity, is_approved)
      VALUES ($1, $2, $3, $4, true)
      RETURNING id, make_model as "makeModel", license_plate as "licensePlate", capacity, is_approved as "isApproved"
    `, [driverId, makeModel, licensePlate, parseInt(capacity)]);

    res.status(201).json({ message: 'Vehicle registered successfully!', vehicle: result.rows[0] });
  } catch (err) {
    console.error('Error admin adding vehicle:', err);
    res.status(500).json({ error: 'Failed to register vehicle.' });
  }
}

module.exports = {
  getOrganizationRidesReport,
  getOrganizationEmployees,
  toggleEmployeeStatus,
  getOrganizationVehicles,
  toggleVehicleApproval,
  updateOrganizationSettings,
  adminAddEmployee,
  adminAddVehicle
};
