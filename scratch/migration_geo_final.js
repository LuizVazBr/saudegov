const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USER, 
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

async function run() {
  console.log('Connecting to:', process.env.PG_HOST);
  try {
    const client = await pool.connect();
    await client.query(`
      ALTER TABLE historicos 
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8), 
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8)
    `);
    console.log('✅ Columns latitude and longitude added to historicos table.');
    client.release();
  } catch (err) {
    console.error('❌ Error modifying table:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
