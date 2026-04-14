
import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const usuarioId = searchParams.get('usuarioId');

        if (!usuarioId) {
            return NextResponse.json({ error: "Usuario ID obrigatorio" }, { status: 400 });
        }

        const client = await pool.connect();

        const result = await client.query(`
      SELECT 
        a.id,
        a.data_hora,
        a.status,
        a.link_sala,
        a.medico_id,
        u.nome as medico_nome
      FROM agendamentos a
      LEFT JOIN profissionais p ON p.id = a.medico_id
      LEFT JOIN usuarios u ON u.id = p.usuario_id
      WHERE a.paciente_id = $1::uuid
      ORDER BY a.data_hora DESC
    `, [usuarioId]);

        client.release();
        return NextResponse.json(result.rows);
    } catch (error: any) {
        console.error("Erro ao buscar agendamentos:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "ID do agendamento obrigatorio" }, { status: 400 });
        }

        const client = await pool.connect();
        await client.query(
            `UPDATE agendamentos SET status = 'cancelado' WHERE id = $1::uuid`,
            [id]
        );
        client.release();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Erro ao cancelar agendamento:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, novaDataHora } = body;

        if (!id || !novaDataHora) {
            return NextResponse.json({ error: "ID e nova data/hora obrigatorios" }, { status: 400 });
        }

        const client = await pool.connect();
        await client.query(
            `UPDATE agendamentos SET data_hora = $1 WHERE id = $2::uuid AND status != 'cancelado'`,
            [novaDataHora, id]
        );
        client.release();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Erro ao reagendar:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
