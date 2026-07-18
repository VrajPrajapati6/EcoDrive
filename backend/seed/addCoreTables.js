const { pool } = require('../config/supabase');

async function addCoreTables() {
  console.log('Adding core carpooling tables...');
  try {
    // 1. Create vehicles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        make_model VARCHAR(255) NOT NULL,
        license_plate VARCHAR(50) NOT NULL,
        capacity INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log(' Table "vehicles" created or verified.');

    // 2. Create rides table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
        vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        pickup_location VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        departure_date DATE NOT NULL,
        departure_time TIME NOT NULL,
        available_seats INTEGER NOT NULL,
        fare_per_seat DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Open', -- 'Open', 'In Progress', 'Completed', 'Cancelled'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log(' Table "rides" created or verified.');

    // 3. Create bookings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
        passenger_id UUID REFERENCES users(id) ON DELETE CASCADE,
        seats_booked INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'Confirmed',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log(' Table "bookings" created or verified.');

    console.log(' Core tables initialization complete!');
  } catch (error) {
    console.error(' Error creating tables:', error);
  } finally {
    pool.end();
  }
}

addCoreTables();
