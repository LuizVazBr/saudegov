import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { pacienteId, nota, foi_cordial, entendeu_problema, satisfeito, observacao, roomName } = body;

        if (!pacienteId || !nota) {
            return NextResponse.json({ error: "pacienteId e nota são obrigatórios." }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            // Tenta encontrar a fila mais recente desse paciente nesse room_name (mesmo se finalizada)
            let filaId = null;
            if (roomName) {
                const filaRes = await client.query(
                    `SELECT id FROM filas_telemedicina 
                     WHERE paciente_id::text = $1 AND room_name LIKE $2 || '%' 
                     ORDER BY data_entrada DESC LIMIT 1`,
                    [pacienteId, roomName.replace('-online', '')]
                );
                if (filaRes.rows.length > 0) {
                    filaId = filaRes.rows[0].id;
                }
            }

            if (!filaId) {
                // Tenta achar a fila finalizada mais recente desse paciente
                const filaRes2 = await client.query(
                    `SELECT id FROM filas_telemedicina 
                     WHERE paciente_id::text = $1 AND status = 'finalizado' 
                     ORDER BY data_entrada DESC LIMIT 1`,
                    [pacienteId]
                );
                if (filaRes2.rows.length > 0) {
                    filaId = filaRes2.rows[0].id;
                }
            }

            await client.query(
                `INSERT INTO avaliacoes_telemedicina 
                (paciente_id, fila_id, nota, foi_cordial, entendeu_problema, satisfeito, observacao) 
                VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [pacienteId, filaId, nota, foi_cordial, entendeu_problema, satisfeito, observacao]
            );

            return NextResponse.json({ success: true });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Erro ao salvar avaliação da telemedicina:", error);
        return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
    }
}
