// src/app/api/user/devices/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import { pool } from "@/lib/pgClient";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userId = session.user.id;
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT * FROM usuarios_dispositivos 
       WHERE user_id = $1 
       ORDER BY ultima_atividade DESC`,
      [userId]
    );

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error("Erro ao buscar dispositivos:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  } finally {
    client.release();
  }
}
