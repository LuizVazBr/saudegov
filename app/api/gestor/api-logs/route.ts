import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";

export const dynamic = 'force-dynamic';

/**
 * Consulta de Logs de Chamada de API (Gestor)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const tipoUsuario = session?.user?.tipo_usuario?.toLowerCase().trim();

    if (!session || tipoUsuario !== "gestor") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");

    const client = await pool.connect();
    // Join opcional com api_keys para mostrar o nome da integradora
    const result = await client.query(`
      WITH counts AS (
        SELECT client_id, ip_origem, COUNT(*) as req_count
        FROM api_logs
        GROUP BY client_id, ip_origem
      )
      SELECT l.*, k.nome as integradora_nome, c.req_count
      FROM api_logs l
      LEFT JOIN api_keys k ON l.client_id = k.client_id
      LEFT JOIN counts c ON (l.client_id = c.client_id AND l.ip_origem = c.ip_origem)
      ORDER BY l.data_cadastro DESC
      LIMIT $1
    `, [limit]);
    client.release();

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Erro ao listar logs:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
