const { pool } = require('../config/supabase');

async function addRecurringRequestsTable() {
  console.log('Adding Recurring Requests table...');
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS recurring_requests (
        id SERIAL PRIMARY KEY,
        passenger_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        pickup_location VARCHAR(255) NOT NULL,
        pickup_lat DECIMAL(10, 8),
        pickup_lon DECIMAL(11, 8),
        destination VARCHAR(255) NOT NULL,
        destination_lat DECIMAL(10, 8),
        destination_lon DECIMAL(11, 8),
        departure_time VARCHAR(5) NOT NULL,
        days JSONB NOT NULL,
        seats_needed INTEGER DEFAULT 1,
        status VARCHAR(20) DEFAULT 'Open',
        accepted_driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createTableQuery);
    console.log(' Table "recurring_requests" created or verified.');
  } catch (error) {
    console.error(' Error creating recurring_requests table:', error);
  } finally {
    process.exit(0);
  }
}

addRecurringRequestsTable();
