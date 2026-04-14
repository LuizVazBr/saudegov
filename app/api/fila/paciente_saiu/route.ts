import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function POST(request: Request) {
    try {
        const { roomName } = await request.json();
        if (!roomName) return NextResponse.json({ error: "roomName is required" }, { status: 400 });

        // Remove the -online suffix to show patient left
        const onlineRoomName = roomName.endsWith('-online') ? roomName : roomName + '-online';
        const rawRoomName = roomName.replace('-online', '');

        const client = await pool.connect();
        try {
            // Remove -online suffix and reset chamado_em to NOW() so 2-min timer restarts
            const result = await client.query(
                `UPDATE filas_telemedicina 
                 SET room_name = $1, chamado_em = NOW()
                 WHERE (room_name = $2 OR room_name = $1) AND status = 'em_atendimento'
                 RETURNING id`,
                [rawRoomName, onlineRoomName]
            );
            return NextResponse.json({ success: true, updated: result.rowCount });
        } finally {
            client.release();
        }
    } catch (e: any) {
        console.error("Erro ao marcar paciente saiu", e);
        return NextResponse.json({ error: "Erro" }, { status: 500 });
    }
}
