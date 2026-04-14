const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'De}s98}p.Ji9GuVbr97C@',
  database: 'anamnex'
});

async function diagnostic() {
  try {
    console.log("--- Categorias ---");
    const catRes = await pool.query('SELECT * FROM categorias');
    console.log(catRes.rows);

    console.log("\n--- Contagem Historicos ---");
    const countRes = await pool.query('SELECT count(*) FROM historicos');
    console.log(countRes.rows[0]);

    console.log("\n--- Contagem Unidades e Unidades Teste ---");
    const uCount = await pool.query('SELECT count(*) FROM unidades');
    const utCount = await pool.query('SELECT count(*) FROM unidades_teste');
    console.log({ unidades: uCount.rows[0].count, unidades_teste: utCount.rows[0].count });

    console.log("\n--- Teste Performance Historico-All (Subquery symptoms) ---");
    const start = Date.now();
    const result = await pool.query(`
      SELECT h.id, (SELECT count(*) FROM historico_sintomas WHERE historico_id = h.id) FROM historicos h LIMIT 10
    `);
    console.log('Execution time: ' + (Date.now() - start) + 'ms');

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

diagnostic();
