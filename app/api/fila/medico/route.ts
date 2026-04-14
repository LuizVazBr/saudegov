import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { v4 as uuidv4 } from "uuid";
import { addNotificationJob } from "@/lib/queue/notificationQueue";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import { redis } from "@/lib/redis";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const client = await pool.connect();
        try {
            const userTipo = (session?.user?.tipo_usuario || "").toLowerCase().trim();
            
            // Se for médico/enfermeiro, atualiza presença no REDIS (super rápido, evita carga no banco)
            if (session?.user?.id && (userTipo === 'medico' || userTipo === 'enfermeiro')) {
                // console.log(`[PRESENCA] Medico ${session.user.id} ativo.`);
                // Atualiza flag global de médico online e flag individual
                await redis.set("presence:any_clinician_online", "true", "EX", 20);
                await redis.set(`presence:clinician:${session.user.id}`, "true", "EX", 20);
                
                // SQL Update: Fallback caso Redis tenha problemas
                await client.query(
                    "UPDATE usuarios SET last_seen_at = NOW() WHERE id = $1",
                    [session.user.id]
                ).catch(err => console.error("Erro ao atualizar last_seen_at (SQL Fallback):", err));
            } else {
                console.log(`[PRESENCA DEBUG] Session ID: ${session?.user?.id}, Tipo: ${userTipo}`);
            }

            // List all waiting or called patients to see the queue status
            const filaRes = await client.query(`
                SELECT 
                    f.id, f.paciente_id, f.status, f.chamado_em, f.data_entrada, f.room_name,
                    u.nome as paciente_nome,
                    (
                        SELECT string_agg(hs.sintoma, ', ')
                        FROM historico_sintomas hs
                        WHERE hs.historico_id = (
                            SELECT h.id FROM historicos h 
                            WHERE h.paciente_id::text = f.paciente_id::text 
                            ORDER BY h.data_cadastro DESC LIMIT 1
                        )
                    ) as sintomas,
                    (
                        SELECT string_agg(hia.tipo, ', ')
                        FROM historico_info_adicional hia
                        WHERE hia.historico_id = (
                            SELECT h.id FROM historicos h 
                            WHERE h.paciente_id::text = f.paciente_id::text 
                            ORDER BY h.data_cadastro DESC LIMIT 1
                        )
                    ) as exames_anexados
                FROM filas_telemedicina f
                LEFT JOIN usuarios u ON u.id::text = f.paciente_id::text
                WHERE f.status IN ('aguardando', 'chamado', 'em_atendimento', 'finalizado', 'cancelado', 'cancelado pelo usuario', 'ausente')
                ORDER BY f.data_entrada ASC
            `);

            // We might want to clear out outdated 'chamado' statuses here as well just to keep the view clean
            // but the main expiration logic happens on the patient side polling. However, a cron or this GET could also clean it up.

            const agora = new Date();
            let hasUpdates = false;

            const patients = filaRes.rows.map(row => {
                if (row.status === "em_atendimento" && row.room_name && !row.room_name.endsWith('-online')) {
                    const limit = new Date(row.chamado_em).getTime() + 120000; // +2 minutes
                    if (agora.getTime() > limit) {
                        hasUpdates = true;
                        row.status = "cancelado";
                    }
                }
                return row;
            });

            if (hasUpdates) {
                // Optimistic DB update to clean up expired calls
                for (const p of patients) {
                    if (p.status === "cancelado") {
                        await client.query("UPDATE filas_telemedicina SET status = 'cancelado' WHERE id = $1", [p.id]);
                    }
                }
            }

            return NextResponse.json(patients);
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error("Erro ao listar fila p/ medico:", error);
        return NextResponse.json({ error: "Erro interno." }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { filaId, medicoId } = body;

        const client = await pool.connect();
        try {
            // Find the patient's ID to fetch their actual Historico UUID
            const pacienteRes = await client.query("SELECT paciente_id FROM filas_telemedicina WHERE id = $1", [filaId]);
            if (pacienteRes.rows.length === 0) {
                return NextResponse.json({ error: "Fila não encontrada" }, { status: 404 });
            }
            const pacienteId = pacienteRes.rows[0].paciente_id;

            // Create a unique room URL for the call
            const roomName = `telemed-${uuidv4().replace(/-/g, '').slice(0, 20)}`;

            const medicoUuid = medicoId && medicoId.length === 36 ? medicoId : null; // Safe UUID check

            await client.query(
                "UPDATE filas_telemedicina SET status = 'chamado', medico_id = $3, room_name = $1, chamado_em = NOW() WHERE id::text = $2",
                [roomName, filaId, medicoUuid]
            );

            // 🔔 Notificar Paciente
            if (pacienteId) {
                addNotificationJob({
                    usuarioId: pacienteId,
                    titulo: "👨‍⚕️ Médico te chamando",
                    mensagem: "Sua consulta online está pronta. Clique aqui para entrar na sala.",
                    url: "/teleconsulta/sala"
                }).catch(err => console.error("Erro ao enviar push chamado:", err));
            }

            return NextResponse.json({ success: true, roomName });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Erro POST chamar paciente", error);
        return NextResponse.json({ error: "Erro interno." }, { status: 500 });
    }
}
