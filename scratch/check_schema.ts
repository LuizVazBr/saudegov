import { pool } from './src/lib/pgClient';

async function checkSchema() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'historicos'
    `);
    console.log('Columns in historicos:', res.rows);

    const res2 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'usuarios'
    `);
    console.log('Columns in usuarios:', res2.rows);
  } finally {
    client.release();
  }
  process.exit(0);
}

checkSchema();
