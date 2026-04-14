
import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { paciente_id, medico_id, data_hora } = body;

        if (!paciente_id || !medico_id || !data_hora) {
            return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
        }

        const client = await pool.connect();

        // Verifica se já existe agendamento
        const check = await client.query(`
        SELECT id FROM agendamentos 
        WHERE medico_id = $1 AND data_hora = $2 AND status != 'cancelado'
    `, [medico_id, data_hora]);

        if (check.rows.length > 0) {
            client.release();
            return NextResponse.json({ error: "Horário não disponível" }, { status: 409 });
        }

        // Cria agendamento
        const result = await client.query(`
      INSERT INTO agendamentos (paciente_id, medico_id, data_hora, status, link_sala)
      VALUES ($1, $2, $3, 'agendado', $4)
      RETURNING id
    `, [paciente_id, medico_id, data_hora, `/teleconsulta/${paciente_id}-${medico_id}`]); // Link ficticio de sala

        client.release();
        return NextResponse.json({ success: true, id: result.rows[0].id });
    } catch (error: any) {
        console.error("Erro ao agendar:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const paciente_id = searchParams.get("paciente_id");

        if (!paciente_id) {
            return NextResponse.json({ error: "paciente_id não informado" }, { status: 400 });
        }

        const client = await pool.connect();

        // Auto-expire past appointments — mark as 'cancelado' if time already passed
        await client.query(
            `UPDATE agendamentos SET status = 'cancelado'
             WHERE paciente_id = $1 AND status = 'agendado' AND data_hora < NOW()`,
            [paciente_id]
        );

        // Only return future active appointments
        const res = await client.query(
            `SELECT * FROM agendamentos
             WHERE paciente_id = $1 AND status != 'cancelado' AND data_hora >= NOW()
             ORDER BY data_hora ASC`,
            [paciente_id]
        );
        client.release();

        return NextResponse.json(res.rows);
    } catch (error: any) {
        console.error("Erro ao buscar agendamentos:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
