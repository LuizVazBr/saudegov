const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

async function run() {
  let client;
  try {
    client = await pool.connect();
    console.log('Connected to DB');
    
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('unidades', 'unidades_teste')");
    console.log('Found tables:', tables.rows);

    for (const row of tables.rows) {
      const table = row.table_name;
      const columns = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}'`);
      console.log(`\nColumns for ${table}:`);
      console.table(columns.rows);
    }

  } catch (err) {
    console.error('Error during research:', err);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

run();
