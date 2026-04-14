
const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'anamnex',
  password: 'De}s98}p.Ji9GuVbr97C@',
  port: 5432,
});

async function checkSchema() {
  const tables = ['historicos', 'unidades', 'unidades_teste', 'usuarios'];
  const results = {};
  
  for (const table of tables) {
    const res = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
      [table]
    );
    results[table] = res.rows;
  }
  
  console.log(JSON.stringify(results, null, 2));
  await pool.end();
}

checkSchema().catch(console.error);
