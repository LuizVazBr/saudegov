import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { jwtVerify } from "jose";
import { logApiCall } from "@/lib/api-logger";

export const dynamic = 'force-dynamic';

/**
 * Endpoint de Listagem de Unidades SaudeGov
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
    const cliente = searchParams.get("cliente") || "Isac_TO";
    const isTeste = searchParams.get("teste") === "true";
    const tableName = isTeste ? "unidades_teste" : "unidades";

    const client = await pool.connect();
    const result = await client.query(`
      SELECT id, nome, tipo, endereco, telefone, whatsapp,
        ST_Y(coordenadas::geometry) AS lat, ST_X(coordenadas::geometry) AS lng
      FROM ${tableName}
      WHERE cliente = $1 AND status = 1
      ORDER BY nome ASC
    `, [cliente]);
    client.release();

    await logApiCall(req, clientId, 200);

    const unidades = result.rows.map(u => ({
      id: u.id, nome: u.nome, tipo: u.tipo, endereco: u.endereco,
      contato: { telefone: u.telefone, whatsapp: u.whatsapp },
      localizacao: { lat: u.lat, lng: u.lng }
    }));

    return NextResponse.json(unidades);

  } catch (err) {
    console.error("Erro no endpoint unidades SaudeGov:", err);
    await logApiCall(req, clientId, 500);
    return NextResponse.json(
      { error: "server_error", error_description: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
