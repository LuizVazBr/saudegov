import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const medicoId = searchParams.get("medicoId");

        if (!medicoId) return NextResponse.json({ error: "Médico não informado" }, { status: 400 });

        const client = await pool.connect();
        const res = await client.query(
            "SELECT * FROM medico_assinaturas WHERE medico_id = $1",
            [medicoId]
        );
        client.release();

        return NextResponse.json(res.rows[0] || {});
    } catch (error: any) {
        console.error("Erro ao buscar assinatura:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        // Apenas gestores podem configurar assinaturas de outros médicos
        // Ou o próprio médico pode configurar a sua (opcional, mas o pedido diz "apenas para o tipo gestor")
        const tipoUsuario = session.user.tipo_usuario?.toLowerCase();
        if (tipoUsuario !== "gestor") {
             return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
        }

        const body = await req.json();
        const { medicoId, assinatura_tipo, assinatura_config } = body;

        if (!medicoId) return NextResponse.json({ error: "Médico não informado" }, { status: 400 });

        const client = await pool.connect();
        
        const check = await client.query("SELECT id FROM medico_assinaturas WHERE medico_id = $1", [medicoId]);
        
        if (check.rows.length > 0) {
            await client.query(
                `UPDATE medico_assinaturas 
                 SET assinatura_tipo = $2, assinatura_config = $3, updated_at = NOW() 
                 WHERE medico_id = $1`,
                [medicoId, assinatura_tipo, JSON.stringify(assinatura_config)]
            );
        } else {
            await client.query(
                `INSERT INTO medico_assinaturas (medico_id, assinatura_tipo, assinatura_config) 
                 VALUES ($1, $2, $3)`,
                [medicoId, assinatura_tipo, JSON.stringify(assinatura_config)]
            );
        }
        
        client.release();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Erro ao salvar assinatura:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const tipoUsuario = session.user.tipo_usuario?.toLowerCase();
        if (tipoUsuario !== "gestor") {
            return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const medicoId = searchParams.get("medicoId");

        if (!medicoId) return NextResponse.json({ error: "Médico não informado" }, { status: 400 });

        const client = await pool.connect();
        await client.query("DELETE FROM medico_assinaturas WHERE medico_id = $1", [medicoId]);
        client.release();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Erro ao remover assinatura:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
