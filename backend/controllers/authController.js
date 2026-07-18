const { pool } = require('../config/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_ecodrive_jwt_key_2026_hackathon';

// Helper to generate JWT token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, organization_id: user.organization_id || user.organizationId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Register a new user
async function register(req, res) {
  const { fullName, email, password, role, organizationId, employeeId, phone } = req.body;

  if (!fullName || !email || !password || !role || !organizationId) {
    return res.status(400).json({ error: 'Please provide all required fields: Full Name, Email, Password, Role, and Organization.' });
  }

  try {
    // Check if user already exists
    const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const isActive = (role === 'Company Administrator');

    // Insert user
    const insertRes = await pool.query(`
      INSERT INTO users (email, password_hash, full_name, role, organization_id, employee_id, phone, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, full_name, role, organization_id, employee_id, phone, is_active, created_at
    `, [email, passwordHash, fullName, role, organizationId, employeeId || '', phone || '', isActive]);

    const user = insertRes.rows[0];

    // Fetch organization details
    const orgRes = await pool.query('SELECT id, name, domain, code FROM organizations WHERE id = $1', [organizationId]);
    user.organization = orgRes.rows[0] || null;

    const token = generateToken(user);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
}

// Login user
async function login(req, res) {
  const { email, password, role, organizationId } = req.body;

  if (!email || !password || !role || !organizationId) {
    return res.status(400).json({ error: 'Please provide Email, Password, Role, and Organization.' });
  }

  try {
    // Find user by email (selecting only required columns, including is_active)
    const userRes = await pool.query('SELECT id, email, password_hash, full_name, role, organization_id, employee_id, phone, is_active FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];

    // Check if user account is active/approved
    if (!user.is_active) {
      return res.status(403).json({ error: 'Your account is pending administrator approval or has been deactivated.' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check role
    if (user.role !== role) {
      return res.status(401).json({ 
        error: `Account role mismatch. You are registered as '${user.role}', but selected '${role}'.` 
      });
    }

    // Check organization
    if (user.organization_id !== organizationId) {
      // Get org name for clearer error message
      const orgRes = await pool.query('SELECT name FROM organizations WHERE id = $1', [user.organization_id]);
      const orgName = orgRes.rows[0]?.name || 'a different organization';
      return res.status(401).json({ 
        error: `Organization mismatch. Your account belongs to ${orgName}.` 
      });
    }

    // Fetch full organization details
    const orgRes = await pool.query('SELECT id, name, domain, code FROM organizations WHERE id = $1', [user.organization_id]);
    const organization = orgRes.rows[0] || null;

    const userData = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      organizationId: user.organization_id,
      employeeId: user.employee_id,
      phone: user.phone,
      organization
    };

    const token = generateToken(userData);

    res.json({
      message: 'Login successful',
      token,
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
}

// Get current logged-in user profile
async function getMe(req, res) {
  try {
    const userRes = await pool.query(`
      SELECT u.id, u.email, u.full_name as "fullName", u.role, u.organization_id as "organizationId", u.employee_id as "employeeId", u.phone, u.is_active as "isActive",
             o.id as "orgId", o.name as "orgName", o.domain as "orgDomain", o.code as "orgCode",
             o.industry as "orgIndustry", o.registered_address as "orgRegisteredAddress", o.admin_contact as "orgAdminContact",
             o.fuel_cost as "orgFuelCost", o.cost_per_km as "orgCostPerKm", o.travel_cost_operational as "orgTravelCostOperational"
      FROM users u
      INNER JOIN organizations o ON u.organization_id = o.id
      WHERE u.id = $1
    `, [req.user.id]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const row = userRes.rows[0];
    
    if (!row.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated or is pending approval.' });
    }

    const user = {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      role: row.role,
      organizationId: row.organizationId,
      employeeId: row.employeeId,
      phone: row.phone,
      organization: row.orgId ? {
        id: row.orgId,
        name: row.orgName,
        domain: row.orgDomain,
        code: row.orgCode,
        industry: row.orgIndustry,
        registeredAddress: row.orgRegisteredAddress,
        adminContact: row.orgAdminContact,
        fuelCost: parseFloat(row.orgFuelCost) || 96.50,
        costPerKm: parseFloat(row.orgCostPerKm) || 8.00,
        travelCostOperational: parseFloat(row.orgTravelCostOperational) || 2.50
      } : null
    };

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error while fetching profile.' });
  }
}

module.exports = {
  register,
  login,
  getMe
};
