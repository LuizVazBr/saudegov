const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

async function checkSchema() {
  try {
    const client = await pool.connect();
    const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tratamentos'");
    console.log('Columns in tratamentos:', res.rows.map(r => r.column_name));
    client.release();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkSchema();
