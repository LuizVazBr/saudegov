const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkUnidadesTeste() {
  const client = await pool.connect();
  try {
    console.log('Checking unidades_teste table...');
    
    // Check columns
    const resCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'unidades_teste'");
    console.log('Columns in unidades_teste:', resCols.rows.map(r => r.column_name).join(', '));

    const res = await client.query('SELECT * FROM unidades_teste');
    console.log('Total rows in unidades_teste:', res.rowCount);
    if (res.rowCount > 0) {
      console.log('Rows:', JSON.stringify(res.rows, null, 2));
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkUnidadesTeste();
