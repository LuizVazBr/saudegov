import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const GET = async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const user_id = url.searchParams.get("user_id");
    if (!user_id) return NextResponse.json({ documentos: [] });

    const query = `
      SELECT id, tipo, nome_arquivo, hash, status, url
      FROM user_documents
      WHERE user_id = $1
      ORDER BY criado_em DESC
    `;
    const result = await pool.query(query, [user_id]);

    return NextResponse.json({ documentos: result.rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao buscar documentos" }, { status: 500 });
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const tipo = formData.get("tipo") as string | null;
    const user_id = formData.get("user_id") as string | null;

    if (!file || !tipo || !user_id) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const ext = path.extname(file.name);
    const fileName = `${hash}${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const query = `
      INSERT INTO user_documents (user_id, tipo, nome_arquivo, hash, status, url)
      VALUES ($1, $2, $3, $4, 'enviado', $5)
      RETURNING nome_arquivo, hash, url
    `;
    const values = [user_id, tipo, fileName, hash, `/uploads/${fileName}`];
    const result = await pool.query(query, values);

    return NextResponse.json({ 
      nomeArquivo: result.rows[0].nome_arquivo,
      hash: result.rows[0].hash,
      url: result.rows[0].url
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao salvar documento" }, { status: 500 });
  }
};

// NOVO: DELETE
export const DELETE = async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const user_id = url.searchParams.get("user_id");
    const hash = url.searchParams.get("hash");

    if (!user_id || !hash) {
      return NextResponse.json({ error: "Parâmetros ausentes" }, { status: 400 });
    }

    // Busca o documento no banco
    const result = await pool.query(
      "SELECT nome_arquivo FROM user_documents WHERE user_id = $1 AND hash = $2",
      [user_id, hash]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    }

    const fileName = result.rows[0].nome_arquivo;
    const filePath = path.join(process.cwd(), "public", "uploads", fileName);

    // Remove arquivo físico se existir
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove do banco
    await pool.query(
      "DELETE FROM user_documents WHERE user_id = $1 AND hash = $2",
      [user_id, hash]
    );

    return NextResponse.json({ message: "Documento removido com sucesso" });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao remover documento" }, { status: 500 });
  }
};
