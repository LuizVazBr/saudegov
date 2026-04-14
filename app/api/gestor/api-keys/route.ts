import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import { v4 as uuidv4 } from "uuid";

export const dynamic = 'force-dynamic';

/**
 * Gestão de Chaves de API (Gestor)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const tipoUsuario = session?.user?.tipo_usuario?.toLowerCase().trim();

    if (!session || tipoUsuario !== "gestor") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const client = await pool.connect();
    const result = await client.query(`
      SELECT id, nome, client_id, client_secret, status, data_cadastro 
      FROM api_keys 
      ORDER BY data_cadastro DESC
    `);
    client.release();

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Erro ao listar chaves:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const tipoUsuario = session?.user?.tipo_usuario?.toLowerCase().trim();

    if (!session || tipoUsuario !== "gestor") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { nome } = await req.json();
    if (!nome) {
      return NextResponse.json({ error: "Nome da integradora é obrigatório." }, { status: 400 });
    }

    // Gerar credenciais únicas
    const client_id = `cliv_${uuidv4().split('-')[0]}_${Math.floor(Math.random() * 1000)}`;
    const client_secret = `sk_${uuidv4().replace(/-/g, '')}`;

    const client = await pool.connect();
    const result = await client.query(`
      INSERT INTO api_keys (nome, client_id, client_secret)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [nome, client_id, client_secret]);
    client.release();

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao criar chave:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const tipoUsuario = session?.user?.tipo_usuario?.toLowerCase().trim();

    if (!session || tipoUsuario !== "gestor") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório." }, { status: 400 });
    }

    const client = await pool.connect();
    // Soft delete ou toggle status
    await client.query(`UPDATE api_keys SET status = CASE WHEN status = 1 THEN 0 ELSE 1 END WHERE id = $1`, [id]);
    client.release();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Erro ao alterar status da chave:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
