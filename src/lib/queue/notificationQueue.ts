import { Queue } from 'bullmq';
import { redis } from '@/lib/redis';

// Tipagem do payload do job
export interface NotificationJobData {
    usuarioId?: string;  // Se undefined, envia para todos
    titulo: string;
    mensagem: string;
    url: string;
    icon?: string;
    badge?: string;
}

// Configuração da fila de notificações
export const notificationQueue = new Queue<NotificationJobData>('push-notifications', {
    connection: redis as any,
    defaultJobOptions: {
        attempts: 3,                    // Tenta 3 vezes em caso de falha
        backoff: {
            type: 'exponential',          // Espera exponencial entre retries
            delay: 2000,                  // Começa com 2s, depois 4s, depois 8s
        },
        removeOnComplete: {
            age: 24 * 3600,               // Remove jobs completos após 24h
            count: 1000,                  // Mantém no máximo 1000 jobs completos
        },
        removeOnFail: {
            age: 7 * 24 * 3600,           // Remove jobs falhados após 7 dias
        },
    },
});

// Helper para adicionar job na fila
export async function addNotificationJob(data: NotificationJobData) {
    const job = await notificationQueue.add('send-push', data, {
        // Prioridade: usuário específico = alta, broadcast = normal
        priority: data.usuarioId ? 1 : 5,
    });

    return {
        jobId: job.id,
        status: 'queued',
        message: data.usuarioId
            ? `Job criado para usuário ${data.usuarioId}`
            : 'Job criado para broadcast (todos os usuários)',
    };
}

// Helper para consultar status de um job
export async function getJobStatus(jobId: string) {
    const job = await notificationQueue.getJob(jobId);

    if (!job) {
        return { error: 'Job não encontrado' };
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
        jobId: job.id,
        status: state,
        progress,
        data: job.data,
        createdAt: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
    };
}
