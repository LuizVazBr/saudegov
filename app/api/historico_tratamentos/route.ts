// app/api/historico_tratamentos/route.ts
import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: Number(process.env.PG_PORT || 5432),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tratamento_id, descricao } = body;

    if (!tratamento_id) {
      return NextResponse.json({ error: "Tratamento não informado" }, { status: 400 });
    }

    const client = await pool.connect();
    const res = await client.query(
      `INSERT INTO historico_tratamentos (tratamento_id, descricao)
       VALUES ($1, $2)
       RETURNING *`,
      [tratamento_id, descricao || ""]
    );
    client.release();

    return NextResponse.json(res.rows[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao iniciar tratamento" }, { status: 500 });
  }
}
