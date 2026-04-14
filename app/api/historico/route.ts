import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pacienteId = searchParams.get("pacienteId");
  const isTeste = searchParams.get("teste") === "true";

  if (!pacienteId) {
    return NextResponse.json({ error: "pacienteId não informado" }, { status: 400 });
  }

  try {
    const client = await pool.connect();
    const targetUnitsTable = isTeste ? "unidades_teste" : "unidades";

    try {
      // ... same fila logic ...
      const colCheck = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'filas_telemedicina' AND column_name = 'historico_id'
        LIMIT 1
      `);
      const hasHistoricoId = colCheck.rows.length > 0;

      const joinFilas = hasHistoricoId
        ? `LEFT JOIN LATERAL (
             SELECT ft2.status, ft2.chamado_em, ft2.data_entrada, ft2.room_name
             FROM filas_telemedicina ft2
             WHERE ft2.historico_id::text = h.id::text
             ORDER BY ft2.data_entrada DESC
             LIMIT 1
           ) ft ON true`
        : `LEFT JOIN (
             SELECT DISTINCT ON (paciente_id) status, chamado_em, data_entrada, room_name, paciente_id
             FROM filas_telemedicina
             ORDER BY paciente_id, data_entrada DESC
           ) ft ON ft.paciente_id::text = h.paciente_id::text`;

      const result = await client.query(`
        SELECT 
          h.id,
          h.descricao, 
          h.data_cadastro,
          c.nome AS categoria,
          hc.classificacao,
          hs.status,
          COALESCE(
            json_agg(hsint.sintoma) FILTER (WHERE hsint.id IS NOT NULL), '[]'
          ) AS sintomas,
          ft.status AS fila_status,
          ft.chamado_em AS fila_chamado_em,
          ft.data_entrada AS fila_data_entrada,
          ft.room_name AS fila_room_name,
          hg.latitude,
          hg.longitude,
          un.nome AS unidade_nome
        FROM historicos h
        JOIN categorias c ON c.id = h.categoria_id
        LEFT JOIN historico_classificacao hc ON hc.historico_id = h.id
        LEFT JOIN (
          SELECT DISTINCT ON (historico_id) *
          FROM historico_status
          ORDER BY historico_id, data_cadastro DESC
        ) hs ON hs.historico_id = h.id
        LEFT JOIN historico_sintomas hsint ON hsint.historico_id = h.id
        LEFT JOIN historico_geolocalizacao hg ON hg.historico_id = h.id
        LEFT JOIN ${targetUnitsTable} un ON un.id::text = h.unidade_id::text
        ${joinFilas}
        WHERE h.paciente_id = $1
        GROUP BY h.id, c.nome, hc.classificacao, hs.status, ft.status, ft.chamado_em, ft.data_entrada, ft.room_name, hg.latitude, hg.longitude, un.nome
        ORDER BY h.data_cadastro DESC
      `, [pacienteId]);

      return NextResponse.json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Erro ao buscar histórico:", err);
    return NextResponse.json({ error: "Erro ao buscar histórico" }, { status: 500 });
  }
}
