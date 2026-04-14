const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'De}s98}p.Ji9GuVbr97C@',
  database: 'anamnex'
});

async function testQuery() {
  try {
    const id = '505bdf6b-e698-445a-963b-5ed6177874ef';
    const query = `
      SELECT 
        h.id, h.descricao, h.data_cadastro,
        c.nome AS categoria, hc.classificacao, us.status,
        COALESCE(u.nome, h.paciente_id::text) AS paciente_nome,
        h.tipo AS origem,
        hg.latitude, hg.longitude,
        h.unidade_id,
        ST_Y(un.coordenadas::geometry) AS unit_lat,
        ST_X(un.coordenadas::geometry) AS unit_lng
      FROM historicos h
      LEFT JOIN categorias c ON c.id = h.categoria_id
      LEFT JOIN usuarios u ON (u.id::text = h.paciente_id::text)
      LEFT JOIN historico_classificacao hc ON hc.historico_id = h.id
      LEFT JOIN historico_geolocalizacao hg ON hg.historico_id = h.id
      LEFT JOIN unidades un ON un.id = h.unidade_id
      LEFT JOIN LATERAL (
        SELECT hs.status
        FROM historico_status hs
        WHERE hs.historico_id = h.id
        ORDER BY hs.data_cadastro DESC
        LIMIT 1
      ) us ON true
      WHERE h.id = $1
    `;
    const res = await pool.query(query, [id]);
    console.log("Record Found:", JSON.stringify(res.rows, null, 2));

    const unitRes = await pool.query('SELECT id, nome, ST_AsText(coordenadas) FROM unidades WHERE id = 46');
    console.log("Unit 46 Data:", JSON.stringify(unitRes.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

testQuery();
