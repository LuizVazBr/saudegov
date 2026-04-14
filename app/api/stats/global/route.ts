import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { redis } from "@/lib/redis";

export async function GET() {
  try {
    const cacheKey = "cliv:stats:global:v1";
    
    // Tenta cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("🚀 Global stats carregas do Redis");
      return NextResponse.json(JSON.parse(cached));
    }

    const client = await pool.connect();
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total, 
          COUNT(*) FILTER (WHERE hc.classificacao ILIKE 'vermelho') as criticos 
        FROM historicos h
        JOIN categorias c ON c.id = h.categoria_id
        LEFT JOIN historico_classificacao hc ON hc.historico_id = h.id
        WHERE c.nome = 'Relato'
      `;
      const statsResult = await client.query(statsQuery);
      
      const stats = {
        total: parseInt(statsResult.rows[0].total || "0"),
        criticos: parseInt(statsResult.rows[0].criticos || "0")
      };

      // Cache curto (30 segundos) para manter alta fidelidade mas aliviar o banco
      await redis.setex(cacheKey, 30, JSON.stringify(stats));
      
      return NextResponse.json(stats);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Erro ao buscar global stats:", err);
    return NextResponse.json({ total: 0, criticos: 0 });
  }
}
