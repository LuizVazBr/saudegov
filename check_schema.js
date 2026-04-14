
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres:De%7Ds98%7Dp.Ji9GuVbr97C%40@localhost:5432/anamnex"
});

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'historicos'");
    console.log("Columns in historicos:", res.rows.map(r => r.column_name).join(", "));
    
    const sample = await client.query("SELECT id, unidade_id FROM historicos ORDER BY data_cadastro DESC LIMIT 5");
    console.log("Last 5 triages:", sample.rows);

    const unitsT = await client.query("SELECT id, nome FROM unidades_teste");
    console.log("Units in unidades_teste:", unitsT.rows);

  } catch (e) {
    console.error("Database error:", e);
  } finally {
    client.release();
    pool.end();
  }
}

check();
