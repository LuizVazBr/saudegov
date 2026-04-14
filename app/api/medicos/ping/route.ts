import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/AuthOptions";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.id) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id, tipo_usuario } = session.user;
    
    if (!["medico", "enfermeiro"].includes(tipo_usuario?.toLowerCase() || "")) {
        return NextResponse.json({ success: true, message: "Ignorado para pacientes e outros roles" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        
        try {
            await client.query("UPDATE usuarios SET last_seen_at = NOW() WHERE id = $1", [id]);
        } catch (updateError: any) {
            // Se a coluna não existe (erro 42703), adiciona e tenta novamente
            if (updateError.code === "42703") {
                await client.query("ALTER TABLE usuarios ADD COLUMN last_seen_at TIMESTAMP DEFAULT NOW()");
                await client.query("UPDATE usuarios SET last_seen_at = NOW() WHERE id = $1", [id]);
            } else {
                throw updateError;
            }
        }

        await client.query("COMMIT");
        return NextResponse.json({ success: true, timestamp: Date.now() });
    } catch (err: any) {
        await client.query("ROLLBACK");
        console.error("Erro POST /api/medicos/ping:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        client.release();
    }
}
