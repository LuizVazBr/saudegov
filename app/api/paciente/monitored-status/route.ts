import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID não informado" }, { status: 400 });
  }

  try {
    const client = await pool.connect();
    const res = await client.query(
      `SELECT CASE WHEN pm.usuario_id IS NOT NULL THEN TRUE ELSE FALSE END as is_monitored 
       FROM usuarios u 
       LEFT JOIN pacientes_monitorados pm ON u.id = pm.usuario_id 
       WHERE u.id = $1`,
      [id]
    );
    client.release();

    if (res.rowCount === 0) {
      return NextResponse.json({ isMonitored: false });
    }

    return NextResponse.json({ isMonitored: res.rows[0].is_monitored });
  } catch (err) {
    console.error("Erro ao verificar status de monitoramento:", err);
    return NextResponse.json({ isMonitored: false, error: "Internal Error" }, { status: 500 });
  }
}
