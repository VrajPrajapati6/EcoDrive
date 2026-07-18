const { pool } = require('../config/supabase');

async function addVehicle(req, res) {
  const { makeModel, licensePlate, capacity } = req.body;
  const userId = req.user.id;

  if (!makeModel || !licensePlate || !capacity) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO vehicles (user_id, make_model, license_plate, capacity)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [userId, makeModel, licensePlate, capacity]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding vehicle:', error);
    res.status(500).json({ error: 'Failed to add vehicle' });
  }
}

async function getMyVehicles(req, res) {
  const userId = req.user.id;

  try {
    const result = await pool.query(`
      SELECT * FROM vehicles WHERE user_id = $1 ORDER BY created_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
}

module.exports = {
  addVehicle,
  getMyVehicles
};
