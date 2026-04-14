
const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'anamnex',
  password: 'De}s98}p.Ji9GuVbr97C@',
  port: 5432,
});

async function testApiLogic() {
  console.log("Testing Historico-All logic...");
  const start = Date.now();
  
  try {
    const client = await pool.connect();
    
    // Test the optimized query
    const query = `
      SELECT 
        h.id, h.descricao, h.data_cadastro,
        c.nome AS categoria, hc.classificacao,
        COALESCE(u.nome, h.paciente_id::text) AS paciente_nome,
        u.documento AS paciente_documento,
        u.sexo, u.data_nascimento,
        h.tipo AS origem,
        h.tempo_transcricao,
        hg.latitude, hg.longitude,
        h.unidade_id,
        COALESCE(ST_Y(un.coordenadas::geometry), ST_Y(unt.coordenadas::geometry)) AS unit_lat,
        COALESCE(ST_X(un.coordenadas::geometry), ST_X(unt.coordenadas::geometry)) AS unit_lng
      FROM historicos h
      LEFT JOIN categorias c ON c.id = h.categoria_id
      LEFT JOIN usuarios u ON u.id = h.paciente_id
      LEFT JOIN historico_classificacao hc ON hc.historico_id = h.id
      LEFT JOIN historico_geolocalizacao hg ON hg.historico_id = h.id
      LEFT JOIN unidades un ON un.id = h.unidade_id
      LEFT JOIN unidades_teste unt ON unt.id = h.unidade_id
      ORDER BY h.data_cadastro DESC
      LIMIT 10;
    `;
    
    const res = await client.query(query);
    const end = Date.now();
    
    console.log(`Success! Fetched ${res.rows.length} rows in ${end - start}ms`);
    if (res.rows.length > 0) {
      console.log("Sample row:", JSON.stringify(res.rows[0], null, 2));
    }
    
    client.release();
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await pool.end();
  }
}

testApiLogic();
