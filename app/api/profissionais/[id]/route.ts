import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const client = await pool.connect();

        const result = await client.query(
            `SELECT 
        u.nome,
        p.especialidade,
        p.crm,
        p.estado_atuacao,
        p.foto
      FROM profissionais p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.id = $1`,
            [id]
        );

        client.release();

        if (result.rows.length === 0) {
            return NextResponse.json(
                { error: "Profissional não encontrado" },
                { status: 404 }
            );
        }

        const doctor = result.rows[0];
        return NextResponse.json({
            nome: doctor.nome,
            especialidade: doctor.especialidade,
            crm: `${doctor.crm}-${doctor.estado_atuacao}`,
            foto: doctor.foto
        });
    } catch (error: any) {
        console.error("Erro ao buscar profissional:", error);
        return NextResponse.json(
            { error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}
