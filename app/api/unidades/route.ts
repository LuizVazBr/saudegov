import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { redis } from "@/lib/redis";

export async function GET(req: NextRequest) {
  let client;
  try {
    const { searchParams } = new URL(req.url);
    const teste = searchParams.get("teste") === "true";
    const refresh = searchParams.get("refresh") === "true";
    const cacheKey = `cliv:unidades:v2:${teste}`;

    if (!refresh) {
      try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
          console.log(`🚀 Unidades ${teste ? 'Teste' : ''} carregadas do Redis`);
          return NextResponse.json(JSON.parse(cachedData));
        }
      } catch (redisErr) {
        console.warn("Redis error (non-fatal):", redisErr);
      }
    } else {
      console.log(`♻️ Refrescando cache para Unidades ${teste ? 'Teste' : ''}`);
    }

    const tabela = teste ? "unidades_teste" : "unidades";
    client = await pool.connect();

    const query = `
      SELECT 
        id, nome, tipo, endereco, telefone, whatsapp, cliente,
        img_url, video_url, audio_url,
        ST_Y(coordenadas::geometry) AS lat,
        ST_X(coordenadas::geometry) AS lng
      FROM ${tabela}
      WHERE status = 1
      ${teste ? "" : "AND cliente = 'Isac_TO'"}
      ORDER BY nome ASC
    `;

    const result = await client.query(query);
    
    const unidades = result.rows.map(u => ({
      id: u.id,
      nome: u.nome,
      tipo: u.tipo,
      endereco: u.endereco,
      telefone: u.telefone,
      whatsapp: u.whatsapp,
      lat: u.lat,
      lng: u.lng,
      cliente: u.cliente,
      imgUrl: u.img_url,
      videoUrl: u.video_url,
      audioUrl: u.audio_url
    }));

    try {
      await redis.setex(cacheKey, 600, JSON.stringify(unidades));
    } catch (redisErr) {
      console.warn("Redis set error (non-fatal):", redisErr);
    }

    return NextResponse.json(unidades);
  } catch (err) {
    console.error("Erro crítico em /api/unidades:", err);
    return NextResponse.json(
      { error: "Erro ao buscar unidades", details: (err as Error).message },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
