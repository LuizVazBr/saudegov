import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function POST(request: Request) {
    try {
        const { roomName } = await request.json();
        if (!roomName) return NextResponse.json({ error: "roomName is required" }, { status: 400 });

        const rawRoomName = roomName.replace('-online', '');

        const client = await pool.connect();
        try {
            await client.query(
                "UPDATE filas_telemedicina SET room_name = $1 || '-online' WHERE room_name = $1",
                [rawRoomName]
            );
            return NextResponse.json({ success: true });
        } finally {
            client.release();
        }
    } catch (e: any) {
        console.error("Erro ao marcar paciente entrou", e);
        return NextResponse.json({ error: "Erro" }, { status: 500 });
    }
}
