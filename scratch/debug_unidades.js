const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

async function check() {
  try {
    const resProd = await pool.query('SELECT count(*), cliente FROM unidades GROUP BY cliente');
    const resTeste = await pool.query('SELECT count(*), cliente FROM unidades_teste GROUP BY cliente');
    
    console.log('--- UNIDADES (PRODUÇÃO) ---');
    console.table(resProd.rows);
    
    const resProdSample = await pool.query('SELECT id, nome, cliente FROM unidades LIMIT 5');
    console.log('Sample production units:');
    console.table(resProdSample.rows);

    console.log('\n--- UNIDADES_TESTE ---');
    console.table(resTeste.rows);
    
    const resTesteSample = await pool.query('SELECT id, nome, cliente FROM unidades_teste LIMIT 5');
    console.log('Sample test units:');
    console.table(resTesteSample.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
