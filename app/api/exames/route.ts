import { NextResponse } from "next/server";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { writeFile } from "fs/promises";
import path from "path";

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: Number(process.env.PG_PORT || 5432),
});

export async function GET(req: Request) {
  const usuarioId = req.url.includes("usuario_id=") ? new URL(req.url).searchParams.get("usuario_id") : null;
  if (!usuarioId) return NextResponse.json({ error: "Usuário não informado" }, { status: 400 });

  try {
    const client = await pool.connect();
    const res = await client.query(
      `SELECT id, descricao, pdf_exame, analise_ia, data_cadastro FROM exames WHERE usuario_id = $1 ORDER BY data_cadastro DESC`,
      [usuarioId]
    );
    client.release();

    // pdf_exame agora é uma URL, não precisa converter
    const rows = res.rows.map(row => ({
      ...row,
      pdf_exame: row.pdf_exame || null,
      analise_ia: row.analise_ia || null
    }));

    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao buscar exames" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { usuario_id, descricao, pdf_exame } = body;

  if (!usuario_id || !descricao || !pdf_exame) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  try {
    // Salvar arquivo no disco
    const id = uuidv4();
    const base64Data = pdf_exame.includes(",") ? pdf_exame.split(",")[1] : pdf_exame;
    const buffer = Buffer.from(base64Data, "base64");

    // Detectar tipo de arquivo
    const isPDF = base64Data.startsWith("JVBERi");
    const extension = isPDF ? "pdf" : "png";
    const filename = `${id}.${extension}`;
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const filePath = path.join(uploadsDir, filename);

    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${filename}`;

    // Salvar no banco com URL do arquivo
    const client = await pool.connect();
    await client.query(
      `INSERT INTO exames (id, usuario_id, descricao, pdf_exame, data_cadastro) VALUES ($1,$2,$3,$4,NOW())`,
      [id, usuario_id, descricao, fileUrl]
    );
    client.release();

    // 🤖 Trigger AI analysis in background
    fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/exames/analisar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exameId: id, imagemBase64: pdf_exame }),
    }).catch(err => console.error("Erro ao analisar exame:", err));

    return NextResponse.json({
      id,
      usuario_id,
      descricao,
      pdf_exame: fileUrl,
      data_cadastro: new Date().toISOString(),
      analise_ia: null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao incluir exame" }, { status: 500 });
  }
}
