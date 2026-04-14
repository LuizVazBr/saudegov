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
    const res = await pool.query('SELECT * FROM categorias');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
