import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { redis } from "@/lib/redis";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Tenta via REDIS (Mais rápido e silencioso)
        const isOnlineRedis = await redis.get("presence:any_clinician_online");
        if (isOnlineRedis) {
            return NextResponse.json({ medicos_online: true, count: 1, source: "redis" });
        }

        const client = await pool.connect();
        
        try {
            // SQL Fallback: Se Redis falhar por qualquer motivo (conexão, etc), olha no banco
            const res = await client.query(`
                SELECT COUNT(*) as count 
                FROM usuarios 
                WHERE (tipo_usuario = 'medico' OR tipo_usuario = 'enfermeiro') 
                AND last_seen_at >= NOW() - INTERVAL '60 seconds'
            `);
            
            const count = parseInt(res.rows[0].count, 10);
            if (count === 0) {
                // Debug: Veja se existem médicos cadastrados sem filtro de tempo
                const totalDocs = await client.query("SELECT COUNT(*) as count FROM usuarios WHERE tipo_usuario = 'medico' OR tipo_usuario = 'enfermeiro'");
                console.log(`[DEBUG PRESENCA] 0 ativos em 30s. Total medicos no banco: ${totalDocs.rows[0].count}`);
            }
            const response = NextResponse.json({ medicos_online: count > 0, count, source: "sql", now: new Date().toISOString() });
            response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            response.headers.set("Pragma", "no-cache");
            response.headers.set("Expires", "0");
            return response;
            
        } catch (dbError: any) {
            if (dbError.code === "42703") {
                // Tenta adicionar a coluna se não existir
                console.log("Coluna last_seen_at não encontrada, tentando configurar...");
                await client.query("ALTER TABLE usuarios ADD COLUMN last_seen_at TIMESTAMP DEFAULT NOW();").catch(() => {});
                return NextResponse.json({ medicos_online: false, count: 0 });
            }
            throw dbError;
        } finally {
            client.release();
        }
        
    } catch (err: any) {
        console.error("Erro GET /api/fila/status-medicos:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
