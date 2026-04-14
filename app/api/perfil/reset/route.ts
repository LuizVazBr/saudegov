import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import { pool } from "@/lib/pgClient";
import { redis } from "@/lib/redis";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  const client = await pool.connect();

  try {
    // 1. Buscar config atual
    const resConfig = await client.query(
      `
      SELECT config
      FROM user_config
      WHERE user_id = $1
      `,
      [session.user.id]
    );

    let currentConfig: Record<string, any> = {};

    // ✅ CORREÇÃO CRÍTICA — usar rows.length
    if (resConfig.rows.length > 0) {
      currentConfig = resConfig.rows[0]?.config || {};
    }

    // 2. Remove a flag dados_confirmados
    const newConfig: Record<string, any> = { ...currentConfig };
    delete newConfig.dados_confirmados;

    await client.query("BEGIN");

    // 3. Atualiza somente se existir registro
    if (resConfig.rows.length > 0) {
      await client.query(
        `
        UPDATE user_config
        SET config = $1
        WHERE user_id = $2
        `,
        [JSON.stringify(newConfig), session.user.id]
      );
    }

    await client.query("COMMIT");

    // 4. Atualiza Redis
    const redisKey = `user_config:${session.user.id}`;
    await redis.set(redisKey, JSON.stringify(newConfig), "EX", 3600);

    return NextResponse.json({
      success: true,
      message: "Resetado com sucesso",
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro reset:", error);

    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
