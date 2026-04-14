import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient"; 
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const userId = session.user.id;

  const res = await pool.query("SELECT config FROM user_config WHERE user_id = $1", [userId]);
  return NextResponse.json(res.rows[0]?.config || {});
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const userId = session.user.id;
  const newConfig = await req.json();

  await pool.query(
    `INSERT INTO user_config(user_id, config)
     VALUES($1, $2)
     ON CONFLICT (user_id)
     DO UPDATE SET config = user_config.config || $2`,
    [userId, newConfig]
  );

  return NextResponse.json({ success: true });
}
