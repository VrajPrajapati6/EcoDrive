const { pool } = require('../config/supabase');

// Get all organizations
async function getOrganizations(req, res) {
  try {
    const result = await pool.query(`
      SELECT id, name, domain, code, is_active 
      FROM organizations 
      WHERE is_active = true 
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
}

// Create a new organization
async function createOrganization(req, res) {
  const { name, domain, code } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Organization name is required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO organizations (name, domain, code, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id, name, domain, code, is_active
    `, [name, domain || '', code || name.substring(0, 4).toUpperCase()]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating organization:', error);
    if (error.code === '23505') { // Postgres unique constraint violation
      return res.status(400).json({ error: 'An organization with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create organization' });
  }
}

module.exports = {
  getOrganizations,
  createOrganization
};
