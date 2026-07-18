const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('\x1b[33m%s\x1b[0m', 'Warning: SUPABASE_URL or SUPABASE_KEY is missing in your environment configuration.');
}

if (!process.env.DATABASE_URL) {
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: DATABASE_URL is missing in your environment configuration!');
  console.error('\x1b[33m%s\x1b[0m', 'Please ensure you have a backend/.env file containing:\nDATABASE_URL=postgresql://username:password@hostname:port/database\n');
}

// Create Supabase client for simple queries/auth if needed
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
);

// Create PG Pool for direct database queries and DDL (table creation)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
});

module.exports = {
  supabase,
  pool
};
