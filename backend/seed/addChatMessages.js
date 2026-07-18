const { pool } = require('../config/supabase');

async function addChatMessages() {
  console.log('Adding ride_messages table...');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ride_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ride_id INTEGER REFERENCES rides(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        sender_name VARCHAR(255) NOT NULL,
        message TEXT,
        timestamp VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table "ride_messages" created successfully.');

  } catch (error) {
    console.error('Error creating ride_messages table:', error);
  } finally {
    process.exit(0);
  }
}

addChatMessages();
