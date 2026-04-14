import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import type { QueryResult } from "pg";

export async function POST(req: Request) {
  try {
    const { historico_id, tipo, descricao, arquivoBase64 } = await req.json();

    if (!historico_id || !tipo) {
      return NextResponse.json(
        { error: "historico_id e tipo são obrigatórios" },
        { status: 400 }
      );
    }

    const tiposPermitidos = ["foto", "áudio", "vídeo", "outro"];
    if (!tiposPermitidos.includes(tipo)) {
      return NextResponse.json(
        { error: "Tipo inválido" },
        { status: 400 }
      );
    }

    // 🔹 Verifica se já existe para esse histórico e tipo
    const existing = await pool.query(
      `SELECT id FROM historico_info_adicional WHERE historico_id = $1 AND tipo = $2 LIMIT 1`,
      [historico_id, tipo]
    );

    let recordId: string;

    if (existing.rows.length > 0) {
      // 🔹 Atualiza se já existe
      recordId = existing.rows[0].id;
      await pool.query(
        `UPDATE historico_info_adicional 
         SET descricao = $1, data_cadastro = NOW(), visto = 0
         WHERE id = $2`,
        [descricao || null, recordId]
      );
    } else {
      // 🔹 Insere se não existe
      const insert = await pool.query(
        `INSERT INTO historico_info_adicional (historico_id, tipo, descricao, visto, data_cadastro)
         VALUES ($1, $2, $3, 0, NOW())
         RETURNING id`,
        [historico_id, tipo, descricao || null]
      );
      recordId = insert.rows[0].id;
    }

    // 🔹 Se tiver arquivo base64 → salvar em uploads
    if (arquivoBase64) {
      const fs = require("fs");
      const path = require("path");

      const extensao =
        tipo === "foto"
          ? "png"
          : tipo === "áudio"
          ? "webm"
          : tipo === "vídeo"
          ? "mp4"
          : "txt";

      const fileName = `${recordId}.${extensao}`;
      const filePath = path.join(process.cwd(), "public", "uploads", fileName);

      const base64Data = arquivoBase64.replace(/^data:.*;base64,/, "");
      fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

      // 🔹 Atualiza descrição para guardar o caminho do arquivo
      await pool.query(
        `UPDATE historico_info_adicional SET descricao = $1 WHERE id = $2`,
        [`/uploads/${fileName}`, recordId]
      );
    }

    return NextResponse.json({
      message: existing.rows.length > 0
        ? "Informação adicional atualizada com sucesso"
        : "Informação adicional salva com sucesso",
      id: recordId,
    });
  } catch (err) {
    console.error("Erro ao salvar info adicional:", err);
    return NextResponse.json(
      { error: "Erro ao salvar informação adicional" },
      { status: 500 }
    );
  }
}
