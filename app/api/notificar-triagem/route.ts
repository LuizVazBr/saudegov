import { NextResponse } from "next/server";
import { addNotificationJob } from '@/lib/queue/notificationQueue';
import { getNotificationWorker } from '@/lib/queue/notificationWorker';

export async function POST(req: Request) {
    try {
        // Garante que o worker está rodando
        getNotificationWorker();

        const body = await req.json();
        const { usuarioId, titulo, mensagem, url } = body;

        // Validação básica
        if (!titulo || !mensagem || !url) {
            return NextResponse.json({
                success: false,
                error: 'Campos obrigatórios: titulo, mensagem, url'
            }, { status: 400 });
        }

        console.log('📨 [API] Criando job de notificação:', { usuarioId, titulo });

        // Adiciona job na fila (retorna imediatamente)
        const result = await addNotificationJob({
            usuarioId,
            titulo,
            mensagem,
            url,
        });

        console.log('✅ [API] Job criado com sucesso:', result.jobId);

        return NextResponse.json({
            success: true,
            ...result,
            statusUrl: `/api/queue-status/${result.jobId}`,
            message: 'Notificação adicionada à fila de processamento',
        });

    } catch (error) {
        console.error('❌ [API] Erro ao criar job de notificação:', error);
        return NextResponse.json({
            success: false,
            error: 'Erro ao processar requisição'
        }, { status: 500 });
    }
}
