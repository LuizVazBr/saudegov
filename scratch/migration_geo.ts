import { pool } from '../src/lib/pgClient';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE historicos 
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8), 
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8)
    `);
    console.log('✅ Columns latitude and longitude added to historicos table.');
  } catch (err) {
    console.error('❌ Error modifying table:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
