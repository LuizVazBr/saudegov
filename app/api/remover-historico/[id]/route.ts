import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { expireQueue } from "@/queues/expireQueue";
import fs from "fs/promises";
import path from "path";

export async function DELETE(req: Request, context: any) {
  const id = context?.params?.id;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "ID não informado" }, { status: 400 });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    // Remove o job da fila, se existir
    await expireQueue.remove(id);

    // 1️⃣ Deletar perguntas de sintomas usando IN
    await client.query(`
      DELETE FROM historico_sintomas_perguntas
      WHERE sintoma_id IN (
        SELECT id FROM historico_sintomas WHERE historico_id = $1
      )
    `, [id]);

    // 2️⃣ Buscar todos os arquivos (info adicional + áudios)
    const [infosRes, audiosRes] = await Promise.all([
      client.query("SELECT descricao FROM historico_info_adicional WHERE historico_id = $1", [id]),
      client.query("SELECT caminho_arquivo FROM historico_audios WHERE historico_id = $1", [id])
    ]);

    const allFiles = [
      ...infosRes.rows.map(r => r.descricao),
      ...audiosRes.rows.map(r => r.caminho_arquivo)
    ].filter(Boolean);

    // 3️⃣ Deletar arquivos em paralelo
    await Promise.all(allFiles.map(async (f) => {
      const filePath = path.join(process.cwd(), "public", f);
      try { await fs.unlink(filePath); }
      catch (err) { console.warn("Não foi possível deletar arquivo:", filePath, err); }
    }));

    // 4️⃣ Deletar registros das tabelas que guardam arquivos
    await Promise.all([
      client.query("DELETE FROM historico_info_adicional WHERE historico_id = $1", [id]),
      client.query("DELETE FROM historico_audios WHERE historico_id = $1", [id])
    ]);

    // 5️⃣ Deletar sintomas
    await client.query("DELETE FROM historico_sintomas WHERE historico_id = $1", [id]);

    // 6️⃣ Deletar demais tabelas relacionadas
    await Promise.all([
      client.query("DELETE FROM historico_atualizacao WHERE historico_id = $1", [id]),
      client.query("DELETE FROM historico_classificacao WHERE historico_id = $1", [id]),
      client.query("DELETE FROM historico_status WHERE historico_id = $1", [id]),
      client.query("DELETE FROM historico_profissionais WHERE historico_id = $1", [id])
    ]);

    // 7️⃣ Por último, deletar o histórico principal
    await client.query("DELETE FROM historicos WHERE id = $1", [id]);

    await client.query("COMMIT");
    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Erro ao excluir histórico:", err);
    if (client) await client.query("ROLLBACK");
    return NextResponse.json({ error: "Erro ao excluir histórico" }, { status: 500 });
  } finally {
    client?.release();
  }
}
