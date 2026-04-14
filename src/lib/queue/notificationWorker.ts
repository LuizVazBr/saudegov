import { Worker, Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { getSubscriptions } from '@/lib/subscriptions';
import webpush from 'web-push';

// Tipagem do payload
interface NotificationJobData {
    usuarioId?: string;
    titulo: string;
    mensagem: string;
    url: string;
    icon?: string;
    badge?: string;
}

// Configurar VAPID
webpush.setVapidDetails(
    'mailto:clivtecnologia@gmail.com',
    process.env.VAPID_PUBLIC!,
    process.env.VAPID_PRIVATE!
);

// Configurações
const BATCH_SIZE = 100;
const RATE_LIMIT_MS = 100;
const MAX_CONCURRENT_JOBS = 5;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função de processamento
async function processNotificationJob(job: Job<NotificationJobData>) {
    try {
        const { usuarioId, titulo, mensagem, url, icon, badge } = job.data;

        console.log(`🚀 [WORKER] Iniciando job ${job.id} - ${usuarioId ? `Usuário ${usuarioId}` : 'BROADCAST'}`);

        const payload = JSON.stringify({
            title: titulo,
            body: mensagem,
            url,
            icon: icon || '/img/cliv.png',
            badge: badge || '/img/cliv.png',
        });

        let totalEnviadas = 0;
        let totalErros = 0;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const subscriptions = await getSubscriptions(usuarioId, BATCH_SIZE, offset);

            if (subscriptions.length === 0) {
                hasMore = false;
                break;
            }

            console.log(`📦 [WORKER] Processando batch: offset=${offset}, count=${subscriptions.length}`);

            for (const sub of subscriptions) {
                try {
                    // Timeout wrapper para evitar travamentos
                    const sendPromise = webpush.sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth,
                            },
                        },
                        payload
                    );

                    // 🚨 Prevenir unhandledRejection se o race terminar por timeout
                    sendPromise.catch(() => {});

                    const sendWithTimeout = Promise.race([
                        sendPromise,
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Push timeout')), 10000)
                        )
                    ]);

                    await sendWithTimeout;
                    totalEnviadas++;
                    await sleep(RATE_LIMIT_MS);
                } catch (err: any) {
                    // Log apenas o erro essencial, não o stack completo
                    const errorMsg = err.message || err.code || 'Erro desconhecido';
                    console.error(`❌ [WORKER] Erro ao enviar para usuário ${sub.usuario_id}: ${errorMsg}`);
                    totalErros++;

                    // Se for erro de rede/timeout, não propaga (evita uncaughtException)
                    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || errorMsg.includes('timeout')) {
                        // Silenciosamente ignora - subscription pode estar inválida
                        continue;
                    }
                }
            }

            const progress = Math.round(((offset + subscriptions.length) / (offset + subscriptions.length + 1)) * 100);
            await job.updateProgress(progress);

            offset += BATCH_SIZE;

            if (subscriptions.length < BATCH_SIZE) {
                hasMore = false;
            }
        }

        console.log(`✅ [WORKER] Job ${job.id} concluído: ${totalEnviadas} enviadas, ${totalErros} erros`);

        return {
            enviadas: totalEnviadas,
            erros: totalErros,
            tipo: usuarioId ? 'específico' : 'broadcast',
        };
    } catch (error: any) {
        console.error(`❌ [WORKER] Erro crítico no job ${job.id}:`, error.message);
        throw error; // Re-throw para BullMQ marcar como failed
    }
}

// Singleton para garantir apenas uma instância do worker
let workerInstance: Worker<NotificationJobData> | null = null;

export function getNotificationWorker() {
    if (!workerInstance) {
        console.log('🔧 [WORKER] Criando nova instância do Notification Worker...');

        workerInstance = new Worker<NotificationJobData>(
            'push-notifications',
            processNotificationJob,
            {
                connection: redis,
                concurrency: MAX_CONCURRENT_JOBS,
                limiter: {
                    max: 10,
                    duration: 1000,
                },
            }
        );

        workerInstance.on('completed', (job) => {
            console.log(`✅ [WORKER] Job ${job.id} completado com sucesso`);
        });

        workerInstance.on('failed', (job, err) => {
            console.error(`❌ [WORKER] Job ${job?.id} falhou:`, err.message);
        });

        workerInstance.on('error', (err) => {
            console.error('❌ [WORKER] Erro no worker:', err);
        });

        workerInstance.on('active', (job) => {
            console.log(`⚡ [WORKER] Job ${job.id} está sendo processado...`);
        });

        console.log('✅ [WORKER] Notification Worker iniciado e aguardando jobs!');
    }

    return workerInstance;
}

// Exporta a instância
export const notificationWorker = getNotificationWorker();
