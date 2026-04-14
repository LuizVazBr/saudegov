// src/app/api/user/device/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import { pool } from "@/lib/pgClient";
import { getDeviceInfo } from "@/lib/deviceDetection";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userId = session.user.id;
  // Pegar User-Agent dos headers e IP do request (se disponível)
  const userAgent = req.headers.get("user-agent") || "";
  const ip = req.headers.get("x-forwarded-for") || "0.0.0.0";

  const info = getDeviceInfo(userAgent);
  const { tipo_dispositivo, modelo, sistema_operacional, navegador, versao_navegador } = info;

  const client = await pool.connect();
  try {
    // Upsert dispositivo baseado em (user_id, modelo, navegador)
    await client.query(
      `INSERT INTO usuarios_dispositivos 
        (user_id, tipo_dispositivo, modelo, sistema_operacional, navegador, versao_navegador, ip_address, ultima_atividade)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, modelo, navegador) 
       DO UPDATE SET 
         versao_navegador = EXCLUDED.versao_navegador,
         ip_address = EXCLUDED.ip_address,
         ultima_atividade = CURRENT_TIMESTAMP`,
      [userId, tipo_dispositivo, modelo, sistema_operacional, navegador, versao_navegador, ip]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao salvar dispositivo:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  } finally {
    client.release();
  }
}
