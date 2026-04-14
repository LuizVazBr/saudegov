// app/api/salvarAudio/route.ts
import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const historicoId = formData.get("historicoId") as string;
    const audioFile = formData.get("audio") as File;

    if (!historicoId || !audioFile) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    // Criar pasta de uploads se não existir
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Gerar nome único para o arquivo
    const ext = audioFile.name.split(".").pop() || "webm";
    const filename = `${uuidv4()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    // Salvar arquivo no disco
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    // Aproximação simples de duração: tamanho / 16000 bytes (~16kb por segundo para mp3/ogg)
    const duracaoSegundos = Math.max(1, Math.round(buffer.length / 16000));

    // Salvar metadados no banco
    const client = await pool.connect();
    await client.query(
      `INSERT INTO historico_audios (historico_id, caminho_arquivo, tipo_mime, duracao_segundos, criado_em)
       VALUES ($1, $2, $3, $4, NOW())`,
      [historicoId, `/uploads/${filename}`, audioFile.type, duracaoSegundos]
    );
    client.release();

    return NextResponse.json({ success: true, file: `/uploads/${filename}` });
  } catch (err) {
    console.error("Erro ao salvar áudio:", err);
    return NextResponse.json({ error: "Erro ao salvar áudio" }, { status: 500 });
  }
}
