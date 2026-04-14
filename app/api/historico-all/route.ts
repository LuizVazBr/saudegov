import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  let client;
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const classificacaoFilter = searchParams.get("classificacao")?.trim() || "todas";
    const statusFilter = searchParams.get("statusFila")?.trim() || "todas";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const minLat = searchParams.get("minLat");
    const maxLat = searchParams.get("maxLat");
    const minLng = searchParams.get("minLng");
    const maxLng = searchParams.get("maxLng");
    const sexo = searchParams.get("sexo")?.trim() || "all";
    const sintoma = searchParams.get("sintoma")?.trim() || "all";
    const isTeste = searchParams.get("teste") === "true";

    client = await pool.connect();

    const targetUnitsTable = isTeste ? "unidades_teste" : "unidades";

    let filterClause = "WHERE 1=1";
    const params: any[] = [];

    if (search) {
      const pIdx = params.length + 1;
      params.push(`%${search}%`);
      filterClause += ` AND (h.id::text ILIKE $${pIdx} OR u.nome ILIKE $${pIdx} OR hc.classificacao ILIKE $${pIdx} OR h.descricao ILIKE $${pIdx})`;
    }

    if (classificacaoFilter !== "todas") {
      params.push(classificacaoFilter);
      filterClause += ` AND hc.classificacao ILIKE $${params.length}`;
    }

    if (minLat && maxLat && minLng && maxLng) {
      params.push(parseFloat(minLat), parseFloat(maxLat), parseFloat(minLng), parseFloat(maxLng));
      const pIdxMinLat = params.length - 3;
      const pIdxMaxLat = params.length - 2;
      const pIdxMinLng = params.length - 1;
      const pIdxMaxLng = params.length;
      filterClause += ` AND hg.latitude >= $${pIdxMinLat} AND hg.latitude <= $${pIdxMaxLat} AND hg.longitude >= $${pIdxMinLng} AND hg.longitude <= $${pIdxMaxLng}`;
    }

    if (sexo !== "all") {
      params.push(sexo);
      filterClause += ` AND u.sexo ILIKE $${params.length}`;
    }

    if (sintoma !== "all") {
      const symptomList = sintoma.split(',').map(s => s.trim()).filter(s => s.length > 0);
      symptomList.forEach(s => {
        params.push(`%${s}%`);
        filterClause += ` AND EXISTS (SELECT 1 FROM historico_sintomas hsint WHERE hsint.historico_id = h.id AND hsint.sintoma ILIKE $${params.length})`;
      });
    }

    // Isola os registros com base no modo
    if (!isTeste) {
      // Produção: Triagens sem unidade OU vinculadas a uma unidade de produção (Isac_TO)
      filterClause += ` AND (h.unidade_id IS NULL OR (un.id IS NOT NULL AND un.cliente = 'Isac_TO'))`;
    } else {
      // Teste: Triagens sem unidade OU vinculadas a qualquer unidade da tabela de teste
      filterClause += ` AND (h.unidade_id IS NULL OR un.id IS NOT NULL)`;
    }

    // Status filter - Usando a subquery de status mais recente
    if (statusFilter !== "todas") {
       let targetStatus = "";
       if (statusFilter === "abertas") targetStatus = "iniciado";
       else if (statusFilter === "andamento") targetStatus = "checkin";
       else if (statusFilter === "finalizadas") targetStatus = "finalizado";
       
       if (targetStatus) {
         params.push(targetStatus);
         filterClause += ` AND (SELECT hs.status FROM historico_status hs WHERE hs.historico_id = h.id ORDER BY hs.data_cadastro DESC LIMIT 1) = $${params.length}`;
       }
    }

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(limit, offset);

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
        ST_Y(un.coordenadas::geometry) AS unit_lat,
        ST_X(un.coordenadas::geometry) AS unit_lng,
        (
          SELECT json_agg(json_build_object('nome', hsint.sintoma))
          FROM historico_sintomas hsint
          WHERE hsint.historico_id = h.id
        ) as sintomas
      FROM historicos h
      LEFT JOIN categorias c ON c.id = h.categoria_id
      LEFT JOIN usuarios u ON u.id = h.paciente_id
      LEFT JOIN historico_classificacao hc ON hc.historico_id = h.id
      LEFT JOIN historico_geolocalizacao hg ON hg.historico_id = h.id
      LEFT JOIN ${targetUnitsTable} un ON un.id::text = h.unidade_id::text
      ${filterClause}
      ORDER BY h.data_cadastro DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const result = await client.query(query, params);
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Erro na consulta historico-all:", err);
    return NextResponse.json(
      { error: "Erro ao buscar histórico", details: (err as Error).message },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}

