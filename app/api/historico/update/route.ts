import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { invalidateTriageCache } from "@/lib/redis";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { historico_id, classificacao, temperatura, pressao, frequencia, descricao_adicional, atualizado_por } = body;

    if (!historico_id) {
      return NextResponse.json({ success: false, error: "historico_id obrigatório" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Inserir atualização da triagem
      await client.query(
        `INSERT INTO historico_atualizacao
         (historico_id, classificacao, temperatura, pressao, frequencia_cardiaca, descricao_adicional, data_cadastro, atualizado_por)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7)`,
        [historico_id, classificacao, temperatura, pressao, frequencia, descricao_adicional, atualizado_por]
      );

      // Inserir status = finalizado
      await client.query(
        `INSERT INTO historico_status
         (historico_id, status, data_cadastro)
         VALUES ($1, 'finalizado', NOW())`,
        [historico_id]
      );

      await client.query("COMMIT");
      await invalidateTriageCache();
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: "Erro ao atualizar triagem" });
  }
}
