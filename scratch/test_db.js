const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'De}s98}p.Ji9GuVbr97C@',
  database: 'anamnex'
});

async function test() {
  try {
    const res = await pool.query('SELECT COUNT(*) FROM historicos');
    console.log('Total historicos:', res.rows[0].count);
    
    const sample = await pool.query('SELECT id, unidade_id, categoria_id FROM historicos ORDER BY data_cadastro DESC LIMIT 5');
    console.log('Sample rows:', sample.rows);
  } catch (err) {
    console.error('DB Error:', err.message);
  } finally {
    await pool.end();
  }
}

test();
