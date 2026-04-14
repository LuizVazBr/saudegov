import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export const dynamic = "force-dynamic";

// GET /api/termos-aceite?pacienteId=<uuid>
// Verifica se o paciente já aceitou ou recusou o termo de telemedicina
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pacienteId = searchParams.get("pacienteId");

  if (!pacienteId) {
    return NextResponse.json({ error: "pacienteId é obrigatório." }, { status: 400 });
  }

  try {
    const client = await pool.connect();
    try {
      // Busca todos os registros desse paciente para telemedicina (aceite ou recusa)
      const res = await client.query(
        "SELECT tipo FROM termos_aceite WHERE paciente_id::text = $1 AND tipo LIKE 'telemedicina%'",
        [pacienteId]
      );
      
      const rows = res.rows;
      const aceito = rows.some(r => r.tipo === "telemedicina");
      const recusado = rows.some(r => r.tipo === "telemedicina_recusa");

      return NextResponse.json({
        aceito,
        recusado,
        // Mantemos compatibilidade com quem esperava aceito_em (opcional)
        aceito_em: rows.find(r => r.tipo === "telemedicina")?.aceito_em || null,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Erro ao verificar termo de aceite:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}

// POST /api/termos-aceite
// Registra o aceite do termo pelo paciente (idempotente — ON CONFLICT DO NOTHING)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pacienteId, tipo = "telemedicina" } = body;

    if (!pacienteId) {
      return NextResponse.json({ error: "pacienteId é obrigatório." }, { status: 400 });
    }

    // Captura IP e User-Agent para registro de auditoria
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const userAgent = request.headers.get("user-agent") || null;

    const client = await pool.connect();
    try {
      if (tipo === "telemedicina") {
        await client.query("DELETE FROM termos_aceite WHERE paciente_id::text = $1 AND tipo = 'telemedicina_recusa'", [pacienteId]);
      } else if (tipo === "telemedicina_recusa") {
        await client.query("DELETE FROM termos_aceite WHERE paciente_id::text = $1 AND tipo = 'telemedicina'", [pacienteId]);
      }

      await client.query(
        `INSERT INTO termos_aceite (paciente_id, tipo, ip, user_agent)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (paciente_id, tipo) DO NOTHING`,
        [pacienteId, tipo, ip, userAgent]
      );
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Erro ao registrar termo de aceite:", error);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
