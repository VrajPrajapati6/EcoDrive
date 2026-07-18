const { pool } = require('../config/supabase');

async function addWalletAndTracking() {
  console.log('Adding Wallet, Tracking, and Payment columns/tables...');
  try {
    // 1. Add wallet_balance to users
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(10, 2) DEFAULT 0.00;
    `);
    console.log(' Column "wallet_balance" added to "users".');

    // 2. Add live location and ETA columns to rides
    await pool.query(`
      ALTER TABLE rides
      ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS current_lon DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS current_eta VARCHAR(100);
    `);
    console.log(' Columns "current_lat", "current_lon", "current_eta" added to "rides".');

    // 3. Add payment columns to bookings
    await pool.query(`
      ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Unpaid',
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
    `);
    console.log(' Columns "payment_status", "payment_method" added to "bookings".');

    // 4. Create wallet_transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        type VARCHAR(50) NOT NULL, -- 'Recharge', 'Payment', 'Received'
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log(' Table "wallet_transactions" created or verified.');

    console.log(' Wallet & Tracking migration complete!');
  } catch (error) {
    console.error(' Error during migration:', error);
  } finally {
    pool.end();
  }
}

addWalletAndTracking();
