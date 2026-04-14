import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { nome, dosagem, principio_ativo, fabricante, descricao } = body;

        if (!nome) {
            return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
        }

        const client = await pool.connect();

        try {
            // Verifica se já existe para evitar duplicatas (mesmo nome e dosagem)
            const check = await client.query(
                "SELECT id FROM medicamentos WHERE nome = $1 AND dosagem = $2",
                [nome, dosagem || ""]
            );

            if (check.rows.length > 0) {
                return NextResponse.json({
                    success: true,
                    message: "Medicamento já existe no banco local",
                    id: check.rows[0].id
                });
            }

            // Insere novo medicamento
            const result = await client.query(
                `INSERT INTO medicamentos (nome, dosagem, principio_ativo, fabricante, descricao, ativo)
                 VALUES ($1, $2, $3, $4, $5, true)
                 RETURNING id`,
                [nome, dosagem || "", principio_ativo || "", fabricante || "", descricao || "Importado da ANVISA"]
            );

            return NextResponse.json({
                success: true,
                id: result.rows[0].id
            });
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error("Import error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
