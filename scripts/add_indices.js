require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1',
  port: Number(process.env.PG_PORT) || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE || 'anamnex'
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("🚀 Iniciando migração de índices...");

    await client.query('CREATE INDEX IF NOT EXISTS idx_historicos_unidade_id ON historicos(unidade_id)');
    console.log("✅ Índice em historicos(unidade_id) criado.");

    await client.query('CREATE INDEX IF NOT EXISTS idx_historico_status_historico_id_data ON historico_status(historico_id, data_cadastro DESC)');
    console.log("✅ Índice em historico_status(historico_id, data_cadastro) criado.");

    await client.query('CREATE INDEX IF NOT EXISTS idx_historico_geolocalizacao_historico_id ON historico_geolocalizacao(historico_id)');
    console.log("✅ Índice em historico_geolocalizacao(historico_id) criado.");

    await client.query('CREATE INDEX IF NOT EXISTS idx_historico_sintomas_historico_id ON historico_sintomas(historico_id)');
    console.log("✅ Índice em historico_sintomas(historico_id) criado.");

    await client.query('CREATE INDEX IF NOT EXISTS idx_unidades_status ON unidades(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_unidades_teste_status ON unidades_teste(status)');
    console.log("✅ Índices em tabelas de unidades criados.");

    console.log("🏁 Migração concluída com sucesso!");
  } catch (err) {
    console.error("❌ Erro na migração:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
