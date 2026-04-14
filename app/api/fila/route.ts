import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { v4 as uuidv4 } from "uuid";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { pacienteId, historicoId } = body;

        if (!pacienteId) {
            return NextResponse.json({ error: "pacienteId é obrigatório." }, { status: 400 });
        }

        const client = await pool.connect();

        try {
            // Cancelar qualquer registro de "aguardando" prévio do mesmo paciente para evitar fila duplicada
            await client.query(
                "UPDATE filas_telemedicina SET status = 'cancelado' WHERE paciente_id::text = $1 AND status = 'aguardando'",
                [pacienteId]
            );

            // Verificar se ele tem uma chamada ativa VÁLIDA
            const checkRes = await client.query(
                "SELECT id, chamado_em FROM filas_telemedicina WHERE paciente_id::text = $1 AND status IN ('chamado', 'em_atendimento') ORDER BY data_entrada DESC LIMIT 1",
                [pacienteId]
            );

            let filaId;

            if (checkRes.rows.length > 0) {
                const rec = checkRes.rows[0];
                const limite = rec.chamado_em ? new Date(rec.chamado_em).getTime() + 120000 : Infinity;

                if (new Date().getTime() <= limite || rec.status === 'em_atendimento') {
                    filaId = rec.id;
                } else {
                    await client.query("UPDATE filas_telemedicina SET status = 'expirado' WHERE id = $1", [rec.id]);
                    filaId = uuidv4();
                    await client.query(
                        "INSERT INTO filas_telemedicina (id, paciente_id, historico_id, status, data_entrada) VALUES ($1, $2, $3, 'aguardando', NOW())",
                        [filaId, pacienteId, historicoId || null]
                    );
                }
            } else {
                // Nova fila — salva o historico_id se informado
                filaId = uuidv4();
                await client.query(
                    "INSERT INTO filas_telemedicina (id, paciente_id, historico_id, status, data_entrada) VALUES ($1, $2, $3, 'aguardando', NOW())",
                    [filaId, pacienteId, historicoId || null]
                );
            }

            return NextResponse.json({ success: true, filaId });
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error("Erro ao entrar na fila de telemedicina:", error);
        return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const pacienteId = searchParams.get("pacienteId");

    if (!pacienteId) {
        return NextResponse.json({ error: "pacienteId é obrigatório." }, { status: 400 });
    }

    try {
        const client = await pool.connect();

        try {
            const filaRes = await client.query(
                "SELECT id, data_entrada, status FROM filas_telemedicina WHERE paciente_id::text = $1 AND status = 'aguardando' ORDER BY data_entrada DESC LIMIT 1",
                [pacienteId]
            );

            if (filaRes.rows.length === 0) {
                return NextResponse.json({ inQueue: false });
            }

            const myDataEntrada = filaRes.rows[0].data_entrada;

            const posRes = await client.query(
                "SELECT COUNT(*) as count FROM filas_telemedicina WHERE status = 'aguardando' AND data_entrada <= $1",
                [myDataEntrada]
            );

            const position = parseInt(posRes.rows[0].count, 10);
            const naFrente = position - 1;
            const tempoEstimadoMinutos = position * 15;

            return NextResponse.json({
                inQueue: true,
                posicao: position,
                naFrente: naFrente,
                tempoEstimadoMinutos: tempoEstimadoMinutos
            });
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error("Erro ao verificar fila de telemedicina:", error);
        return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
    }
}
