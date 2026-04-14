import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { jwtVerify } from "jose";
import { logApiCall } from "@/lib/api-logger";

export const dynamic = 'force-dynamic';

/**
 * Endpoint de Proximidade SaudeGov
 * Requer autenticação via Bearer Token (OAuth 2.0).
 */
export async function GET(req: NextRequest) {
  let clientId = "anonimo";
  try {
    const authHeader = req.headers.get("Authorization");
    const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "anamnex_jwt_secret_key_2026");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (!bearerToken) {
      await logApiCall(req, "unauthorized", 401);
      return NextResponse.json(
        { error: "unauthorized", error_description: "Autenticação necessária. Envie um token Bearer válido." },
        { status: 401 }
      );
    }

    try {
      const { payload } = await jwtVerify(bearerToken, JWT_SECRET);
      clientId = (payload.sub as string) || "unknown";
    } catch (err) {
      await logApiCall(req, "invalid_token", 401);
      return NextResponse.json(
        { error: "invalid_token", error_description: "Token de acesso inválido ou expirado." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");
    const isTeste = searchParams.get("teste") === "true";
    const tableName = isTeste ? "unidades_teste" : "unidades";

    if (!latStr || !lngStr) {
      await logApiCall(req, clientId, 400);
      return NextResponse.json(
        { error: "invalid_request", error_description: "Parâmetros 'lat' e 'lng' são obrigatórios." },
        { status: 400 }
      );
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      await logApiCall(req, clientId, 400);
      return NextResponse.json(
        { error: "invalid_request", error_description: "Coordenadas geográficas inválidas." },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    const query = `
      SELECT id, nome, tipo, endereco, telefone, whatsapp,
        ST_Y(coordenadas::geometry) AS lat, ST_X(coordenadas::geometry) AS lng,
        ST_Distance(coordenadas::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distancia_km
      FROM ${tableName}
      WHERE status = 1
      ORDER BY coordenadas::geography <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      LIMIT 1;
    `;

    const result = await client.query(query, [lng, lat]);
    client.release();

    if (result.rows.length === 0) {
      await logApiCall(req, clientId, 404);
      return NextResponse.json(
        { error: "not_found", error_description: "Nenhuma unidade encontrada." },
        { status: 404 }
      );
    }

    await logApiCall(req, clientId, 200);

    const unidade = result.rows[0];
    return NextResponse.json({
        success: true,
        data: {
          id: unidade.id, nome: unidade.nome, tipo: unidade.tipo, endereco: unidade.endereco,
          contato: { telefone: unidade.telefone, whatsapp: unidade.whatsapp },
          localizacao: { lat: unidade.lat, lng: unidade.lng },
          distancia_aproximada_km: parseFloat(unidade.distancia_km.toFixed(2))
        }
    });

  } catch (err) {
    console.error("Erro no endpoint proximidade:", err);
    await logApiCall(req, clientId, 500);
    return NextResponse.json(
      { error: "server_error", error_description: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
