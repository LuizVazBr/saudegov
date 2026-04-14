import { NextResponse } from "next/server";
import { Pool } from "pg";

// Configuração do PostgreSQL
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: Number(process.env.PG_PORT || 5432),
});

export async function GET() {
  try {
    const client = await pool.connect();
    const res = await client.query(`
      SELECT c.id, ct.nome AS nome, c.desde_quando AS desde, c.descricao
      FROM condicoes c
      JOIN condicoes_tipos ct ON c.condicao_tipo_id = ct.id
      ORDER BY c.desde_quando DESC
    `);
    client.release();

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao buscar condições" }, { status: 500 });
  }
}
