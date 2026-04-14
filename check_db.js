
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres:De%7Ds98%7Dp.Ji9GuVbr97C%40@localhost:5432/anamnex"
});

async function check() {
  const client = await pool.connect();
  try {
    const units = await client.query("SELECT COUNT(*) FROM unidades");
    const unitsTeste = await client.query("SELECT COUNT(*) FROM unidades_teste");
    const triagens = await client.query("SELECT COUNT(*) FROM historicos");
    const triagensSample = await client.query("SELECT id, unidade_id FROM historicos ORDER BY data_cadastro DESC LIMIT 10");
    const unitSample = await client.query("SELECT id, nome, cliente FROM unidades LIMIT 10");
    
    console.log("Unidades count:", units.rows[0].count);
    console.log("Unidades Teste count:", unitsTeste.rows[0].count);
    console.log("Triagens count:", triagens.rows[0].count);
    console.log("Triagens Sample (unidade_id):", triagensSample.rows.map(r => r.unidade_id));
    console.log("Unidades Sample (id, cliente):", unitSample.rows.map(r => ({id: r.id, cliente: r.cliente})));
    
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

check();
