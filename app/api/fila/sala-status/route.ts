import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const roomName = searchParams.get("roomName");

    if (!roomName) {
        return NextResponse.json({ error: "roomName é obrigatório." }, { status: 400 });
    }

    try {
        const client = await pool.connect();
        try {
            // Accept either the base room name or the -online version
            const rawRoom = roomName.replace('-online', '');

            const res = await client.query(
                `SELECT id, status FROM filas_telemedicina 
                 WHERE (room_name = $1 OR room_name = $1 || '-online') 
                 ORDER BY data_entrada DESC LIMIT 1`,
                [rawRoom]
            );

            if (res.rows.length === 0) {
                return NextResponse.json({ status: "nao_encontrado" });
            }

            const row = res.rows[0];
            return NextResponse.json({ status: row.status });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Erro ao verificar status da sala:", error);
        return NextResponse.json({ error: "Erro interno." }, { status: 500 });
    }
}
