import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let client;
  try {
    client = await pool.connect();

    const { searchParams } = new URL(req.url);
    const isTeste = searchParams.get("teste") === "true";
    const targetUnitsTable = isTeste ? "unidades_teste" : "unidades";

    // 1. Unidades (Com Fallback se a tabela ou coluna falhar)
    let units = [];
    try {
      const unitsRes = await client.query(`
        SELECT 
          id, nome, tipo, endereco,
          ST_Y(coordenadas::geometry) AS lat,
          ST_X(coordenadas::geometry) AS lng,
          COALESCE(status_operacional, 'Normal') as status
        FROM ${targetUnitsTable}
        WHERE status = 1
      `);
      units = unitsRes.rows.map(u => ({
        ...u,
        lat: parseFloat(u.lat),
        lng: parseFloat(u.lng),
        metrics: {
          waitingTime: Math.floor(Math.random() * 40),
          totalPatients: Math.floor(Math.random() * 200),
          satisfaction: 85 + Math.floor(Math.random() * 15)
        }
      }));
    } catch (e) {
      console.warn("Erro ao buscar unidades (Mapa INSS):", (e as Error).message);
    }

    // 2. Pacientes/Inteligência (Com Fallback se as tabelas de demo não existirem)
    let patients = [];
    try {
      const patientsRes = await client.query(`
        SELECT 
          d.paciente_nome as nome, d.cpf, d.doenca, d.status as status_clinico,
          d.latitude as lat, d.longitude as lng,
          COALESCE(s.score_incapacidade, 0) as score,
          s.risco, COALESCE(s.custo_estimado, 0) as custo_estimado
        FROM paciente_doencas d
        LEFT JOIN paciente_score s ON s.cpf = d.cpf
      `);
      patients = patientsRes.rows.map(p => ({
        ...p,
        lat: parseFloat(p.lat),
        lng: parseFloat(p.lng),
        score: parseInt(p.score),
        custo_estimado: parseFloat(p.custo_estimado)
      }));
    } catch (e) {
      console.warn("Tabelas de Inteligência Demo não encontradas. Pulando camada de calor.");
    }

    // 3. Triagens em Tempo Real (Pulsos) - PRIORIDADE
    let triages = [];
    try {
      const triageRes = await client.query(`
          SELECT 
              h.id, h.data_cadastro,
              hc.classificacao,
              hg.latitude as lat,
              hg.longitude as lng,
              u.nome as paciente_nome
          FROM historicos h
          LEFT JOIN historico_classificacao hc ON hc.historico_id = h.id
          LEFT JOIN historico_geolocalizacao hg ON hg.historico_id = h.id
          LEFT JOIN usuarios u ON u.id = h.paciente_id
          WHERE hg.latitude IS NOT NULL AND hg.longitude IS NOT NULL
          ORDER BY h.data_cadastro DESC
          LIMIT 500
      `);
      triages = triageRes.rows.map(t => ({
          ...t,
          lat: parseFloat(t.lat),
          lng: parseFloat(t.lng),
          classificacao: t.classificacao || 'Verde'
      }));
    } catch (e) {
      console.error("Erro crítico ao buscar triagens reais:", e);
    }

    return NextResponse.json({ units, patients, triages });

  } catch (err) {
    console.error("Erro fatal na API de Mapa INSS:", err);
    return NextResponse.json({ error: "Erro interno", details: (err as Error).message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
