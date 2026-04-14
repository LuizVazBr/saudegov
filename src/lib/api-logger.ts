import { pool } from "./pgClient";
import { NextRequest } from "next/server";

/**
 * Registra uma chamada de API na tabela de logs para monitoramento do gestor.
 */
export async function logApiCall(req: NextRequest, clientId: string | null, statusCode: number) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "0.0.0.0";
    const userAgent = req.headers.get("user-agent") || "desconhecido";
    const { pathname } = new URL(req.url);
    const method = req.method;

    const client = await pool.connect();
    await client.query(`
      INSERT INTO api_logs (client_id, endpoint, metodo, ip_origem, user_agent, status_code)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [clientId, pathname, method, ip, userAgent, statusCode]);
    client.release();
  } catch (err) {
    console.error("Erro ao registrar log de API:", err);
  }
}
