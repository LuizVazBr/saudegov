const { Pool } = require('pg');
const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'De}s98}p.Ji9GuVbr97C@',
  database: 'anamnex'
});

async function diagnostic() {
  try {
    console.log("--- 1. Checking specific record and its relations ---");
    const id = '505bdf6b-e698-445a-963b-5ed6177874ef';
    
    const h = await pool.query('SELECT * FROM historicos WHERE id = $1', [id]);
    console.log("historico:", h.rows[0]);

    const g = await pool.query('SELECT * FROM historico_geolocalizacao WHERE historico_id = $1', [id]);
    console.log("geolocalizacao:", g.rows[0]);

    const u = await pool.query('SELECT id, nome, ST_AsText(coordenadas) as coords FROM unidades WHERE id = 46');
    console.log("unidade 46:", u.rows[0]);

    console.log("\n--- 2. Checking Categorias content ---");
    const c = await pool.query('SELECT id, nome FROM categorias');
    console.log("categorias:", c.rows);

    console.log("\n--- 3. Testing the FULL Dashboard Query Logic ---");
    const query = `
      SELECT 
        h.id, h.categoria_id, c.nome as cat_nome, un.id as unit_id,
        hg.latitude, hg.longitude,
        ST_Y(un.coordenadas::geometry) as u_lat,
        ST_X(un.coordenadas::geometry) as u_lng
      FROM historicos h
      LEFT JOIN categorias c ON c.id = h.categoria_id
      LEFT JOIN historico_geolocalizacao hg ON hg.historico_id = h.id
      LEFT JOIN unidades un ON un.id = h.unidade_id
      WHERE h.id = $1
    `;
    const res = await pool.query(query, [id]);
    console.log("Query Result:", res.rows[0]);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

diagnostic();
