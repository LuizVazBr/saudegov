import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";

    if (q.length < 2) {
        return NextResponse.json([]);
    }

    try {
        const client = await pool.connect();
        try {
            // Busca parcial insensível a maiúsculas/minúsculas retornando nome e dosagem
            const res = await client.query(
                `SELECT nome, dosagem 
                 FROM medicamentos 
                 WHERE nome ILIKE $1 AND ativo = true
                 ORDER BY nome ASC 
                 LIMIT 10`,
                [`%${q}%`]
            );

            // Retorna objetos com nome e dosagem para o modal processar
            return NextResponse.json(res.rows);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Erro na busca de medicamentos:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
