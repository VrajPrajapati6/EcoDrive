const { pool } = require('./config/supabase');

async function checkTypes() {
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'rides'");
    console.log("Rides table:");
    console.log(res.rows);

    const res2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
    console.log("Users table:");
    console.log(res2.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkTypes();
