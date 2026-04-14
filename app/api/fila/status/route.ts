import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export const dynamic = 'force-dynamic';

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
                "SELECT id, data_entrada, status, room_name, chamado_em FROM filas_telemedicina WHERE paciente_id::text = $1 AND status IN ('aguardando', 'chamado', 'em_atendimento') ORDER BY data_entrada DESC LIMIT 1",
                [pacienteId]
            );

            if (filaRes.rows.length === 0) {
                return NextResponse.json({ status: "cancelado" });
            }

            const record = filaRes.rows[0];

            if (record.status === "chamado" || record.status === "em_atendimento") {
                const chamadoEm = new Date(record.chamado_em);
                const agora = new Date();
                const diffEmSegundos = Math.floor((agora.getTime() - chamadoEm.getTime()) / 1000);

                const tempoRestante = 120 - diffEmSegundos;

                if (tempoRestante <= 0 && record.status === "em_atendimento") {
                    // Timeout estourou
                    await client.query("UPDATE filas_telemedicina SET status = 'cancelado' WHERE id = $1", [record.id]);
                    return NextResponse.json({ status: "expirado" });
                }

                return NextResponse.json({
                    status: record.status,
                    roomName: record.room_name,
                    tempoRestante: record.status === "chamado" ? 120 : tempoRestante
                });
            }

            // Se for aguardando, calcular a posição
            const posRes = await client.query(
                "SELECT COUNT(*) as count FROM filas_telemedicina WHERE status = 'aguardando' AND data_entrada <= $1",
                [record.data_entrada]
            );

            const countAnterioresData = parseInt(posRes.rows[0].count, 10);
            const position = Math.max(1, countAnterioresData);
            const naFrente = countAnterioresData > 0 ? countAnterioresData - 1 : 0;

            // --- NOVO CÁLCULO DE TEMPO ESTIMADO ---
            let tempoEstimadoSegundos = 0;
            const tempoMedioSlot = 300; // 5 minutos por consulta

            if (position === 1) {
                // Se sou o primeiro, a espera é curta (o médico deve chamar em breve ou já está terminando a anterior)
                tempoEstimadoSegundos = 59; // "Menos de 1 minuto"
            } else {
                // Ver se há alguém em atendimento agora
                const consultRes = await client.query(
                    "SELECT chamado_em FROM filas_telemedicina WHERE status = 'em_atendimento' ORDER BY chamado_em DESC LIMIT 1"
                );

                if (consultRes.rows.length > 0) {
                    const consultStart = new Date(consultRes.rows[0].chamado_em);
                    const elapsed = Math.floor((new Date().getTime() - consultStart.getTime()) / 1000);
                    const remainingCurrent = Math.max(30, tempoMedioSlot - elapsed);
                    
                    // Tempo total = (outras consultas no meio) + tempo restante desta
                    const consultasNoMeio = position - 2; 
                    tempoEstimadoSegundos = (consultasNoMeio * tempoMedioSlot) + remainingCurrent;
                } else {
                    // Ninguém em atendimento? Apenas somar slots
                    tempoEstimadoSegundos = (position - 1) * tempoMedioSlot;
                }
            }

            return NextResponse.json({
                status: "aguardando",
                posicao: position,
                naFrente: naFrente,
                tempoEstimadoMinutos: Math.ceil(tempoEstimadoSegundos / 60),
                tempoEstimadoSegundos: tempoEstimadoSegundos
            });

        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error("Erro ao verificar status da fila:", error);
        return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { pacienteId, novoStatus } = body;

        const client = await pool.connect();
        try {
            if (novoStatus === 'em_atendimento') {
                const updateRes = await client.query(
                    "UPDATE filas_telemedicina SET status = $1, chamado_em = NOW() WHERE paciente_id::text = $2 AND status IN ('aguardando', 'chamado', 'em_atendimento') RETURNING room_name",
                    [novoStatus, pacienteId]
                );

                // Send Notifications
                try {
                    const userRes = await client.query("SELECT nome, telefone, telefone_whatsapp FROM usuarios WHERE id::text = $1", [pacienteId]);
                    if (userRes.rows.length > 0) {
                        const user = userRes.rows[0];
                        
                        // Push Notification
                        let baseUrl = "http://localhost:3000";
                        if (request.headers.get("host")) {
                            const proto = request.headers.get("x-forwarded-proto") || "http";
                            baseUrl = `${proto}://${request.headers.get("host")}`;
                        } else if (process.env.NEXT_PUBLIC_SITE_URL) {
                            baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
                        }

                        fetch(`${baseUrl}/api/notificar-triagem`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                usuarioId: pacienteId,
                                titulo: "👨‍⚕️ O Médico Chegou!",
                                mensagem: `Olá ${user.nome.split(' ')[0]}, o médico já está na sala aguardando você iniciar a chamada de vídeo. Você tem 2 minutos para entrar.`,
                                url: "/fila-telemedicina"
                            })
                        }).catch(e => console.error("Push Error", e));

                        // WhatsApp Notification
                        if (user.telefone_whatsapp && user.telefone) {
                            fetch(`${baseUrl}/api/whatsapp`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    to: `55${user.telefone.replace(/\D/g, '')}`,
                                    type: "whatsapp",
                                    bodyVar1: user.nome.split(' ')[0], // We can assume clivtri template has 4 variables in the previous snippet
                                    bodyVar2: "O médico já está na sala de telemedicina.",
                                    bodyVar3: "Acesse o aplicativo agora", 
                                    bodyVar4: "Você tem 2 minutos para entrar."
                                })
                            }).catch(e => console.error("WhatsApp Error", e));
                        }
                    }
                } catch (notiError) {
                    console.error("Erro ao notificar paciente", notiError);
                }

            } else {
                await client.query(
                    "UPDATE filas_telemedicina SET status = $1 WHERE paciente_id::text = $2 AND status IN ('aguardando', 'chamado', 'em_atendimento')",
                    [novoStatus, pacienteId]
                );
            }
            return NextResponse.json({ success: true });
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error("Erro PUT status da fila:", error);
        return NextResponse.json({ error: error.message || "Erro interno." }, { status: 500 });
    }
}
