import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { invalidateTriageCache } from "@/lib/redis";
import type { QueryResult } from "pg";

export async function POST(req: Request) {
  try {
    const { historico_id, status } = await req.json();

    if (!historico_id || !status) {
      return NextResponse.json(
        { error: "historico_id e status são obrigatórios" },
        { status: 400 }
      );
    }

    // 🔹 Verifica se já existe algum "visto" para este histórico
    const checkVistoQuery = `
      SELECT id FROM historico_status
      WHERE historico_id = $1 AND status = 'visto'
      LIMIT 1;
    `;
    const checkVistoResult: QueryResult<{ id: string }> = await pool.query(
      checkVistoQuery,
      [historico_id]
    );

    if ((checkVistoResult?.rowCount ?? 0) > 0) {
      return NextResponse.json({
        message: "Este histórico já foi marcado como visto",
      });
    }

    // 🔹 Se não houver "visto", mas já existir o mesmo status, evita duplicação
    const checkSameQuery = `
      SELECT id FROM historico_status
      WHERE historico_id = $1 AND status = $2
      LIMIT 1;
    `;
    const checkSameResult: QueryResult<{ id: string }> = await pool.query(
      checkSameQuery,
      [historico_id, status]
    );

    if ((checkSameResult?.rowCount ?? 0) > 0) {
      return NextResponse.json({
        message: "Já existe este status para o histórico",
      });
    }

    // 🔹 Insere novo status
    const insertQuery = `
      INSERT INTO historico_status (historico_id, status)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const insertResult: QueryResult<{
      id: string;
      historico_id: string;
      status: string;
    }> = await pool.query(insertQuery, [historico_id, status]);

    // Invalida o cache para que o gestor veja a mudança
    await invalidateTriageCache();

    return NextResponse.json({
      message: "Status inserido com sucesso",
      data: insertResult.rows[0],
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Erro ao inserir status" },
      { status: 500 }
    );
  }
}
