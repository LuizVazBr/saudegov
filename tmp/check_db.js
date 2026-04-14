const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

async function check() {
  try {
    const res = await pool.query('SELECT DISTINCT tipo_usuario FROM usuarios');
    console.log('User types in DB:', res.rows);
    
    const count = await pool.query('SELECT tipo_usuario, count(*) FROM usuarios GROUP BY tipo_usuario');
    console.log('Counts:', count.rows);
    
    const schema = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'usuarios'");
    console.log('Columns:', schema.rows);
    
    // Check first 10 users to see format
    const users = await pool.query("SELECT id, nome, tipo_usuario FROM usuarios LIMIT 10");
    console.log('Sample Users:', users.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
