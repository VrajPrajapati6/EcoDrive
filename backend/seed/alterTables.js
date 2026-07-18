const { pool } = require('../config/supabase');

async function alterDatabase() {
  console.log('Altering database tables to support map coordinates, booking requests, and fare calculations...');
  try {
    // 1. Add coordinate columns to rides table
    await pool.query(`
      ALTER TABLE rides 
      ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS pickup_lon DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS destination_lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS destination_lon DOUBLE PRECISION;
    `);
    console.log(' Columns pickup_lat, pickup_lon, destination_lat, destination_lon added to "rides".');

    // 2. Add custom pickup columns, status, distance, and fare to bookings table
    await pool.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS pickup_location VARCHAR(255),
      ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS pickup_lon DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS distance_km DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS fare DECIMAL(10, 2);
    `);
    console.log(' Columns pickup_location, pickup_lat, pickup_lon, distance_km, fare added to "bookings".');

    // 3. Update bookings status column constraint or default (if needed, but default is already 'Confirmed')
    // We will change booking status to default to 'Requested' so new booking requests are pending by default.
    await pool.query(`
      ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'Requested';
    `);
    console.log(' Default status for bookings updated to "Requested".');

    console.log(' Database alteration complete!');
  } catch (error) {
    console.error(' Error altering database:', error);
  } finally {
    pool.end();
  }
}

alterDatabase();
