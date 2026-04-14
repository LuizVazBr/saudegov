import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { SignJWT } from "jose";
import { logApiCall } from "@/lib/api-logger";

export const dynamic = 'force-dynamic';

/**
 * Endpoint OAuth 2.0 Token para SaudeGov (Versão Dinâmica via Banco)
 */
export async function POST(req: NextRequest) {
  let clientIdForLog = null;
  try {
    const body = await req.json();
    const { client_id, client_secret } = body;
    clientIdForLog = client_id;

    if (!client_id || !client_secret) {
      const res = NextResponse.json(
        { error: "invalid_request", error_description: "client_id e client_secret são obrigatórios." },
        { status: 400 }
      );
      await logApiCall(req, clientIdForLog, 400);
      return res;
    }

    const client = await pool.connect();
    
    // Validar no banco de dados
    const result = await client.query(`
      SELECT * FROM api_keys 
      WHERE client_id = $1 AND client_secret = $2 AND status = 1
    `, [client_id, client_secret]);
    
    client.release();

    if (result.rows.length === 0) {
      const res = NextResponse.json(
        { error: "invalid_client", error_description: "Credenciais de API inválidas ou chave inativa." },
        { status: 401 }
      );
      await logApiCall(req, clientIdForLog, 401);
      return res;
    }

    const apiKey = result.rows[0];

    // Gerar Token JWT com expiração de 24h
    const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "anamnex_jwt_secret_key_2026");
    const token = await new SignJWT({ 
        sub: apiKey.client_id, 
        iss: "Anamnex", 
        integrador: apiKey.nome,
        scope: "saudegov.read" 
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    await logApiCall(req, clientIdForLog, 200);

    return NextResponse.json({
      access_token: token,
      token_type: "Bearer",
      expires_in: 86400,
      scope: "saudegov.read"
    });

  } catch (err) {
    console.error("Erro OAuth Token:", err);
    await logApiCall(req, clientIdForLog, 500);
    return NextResponse.json(
      { error: "server_error", error_description: "Erro interno ao gerar token." },
      { status: 500 }
    );
  }
}
