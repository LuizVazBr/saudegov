import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function GET() {
    try {
        const client = await pool.connect();
        try {
            await client.query("ALTER TABLE filas_telemedicina ADD COLUMN chamado_em TIMESTAMP;");
            await client.query("ALTER TABLE usuarios ADD COLUMN last_seen_at TIMESTAMP DEFAULT NOW();");
            return NextResponse.json({ success: true, message: "Colunas 'chamado_em' e 'last_seen_at' configuradas." });
        } catch (e: any) {
            if (e.code === '42701') {
                // column already exists
                return NextResponse.json({ success: true, message: "As colunas já existiam." });
            }
            throw e;
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error("Erro ao configurar DB:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
