import { NextResponse } from 'next/server';
import { notificationQueue } from '@/lib/queue/notificationQueue';
import { getNotificationWorker } from '@/lib/queue/notificationWorker';

export async function GET() {
    try {
        // Força inicialização do worker
        const worker = getNotificationWorker();

        // Pega estatísticas da fila
        const waiting = await notificationQueue.getWaitingCount();
        const active = await notificationQueue.getActiveCount();
        const completed = await notificationQueue.getCompletedCount();
        const failed = await notificationQueue.getFailedCount();

        return NextResponse.json({
            worker: {
                status: 'running',
                isRunning: worker.isRunning(),
                isPaused: worker.isPaused(),
            },
            queue: {
                name: 'push-notifications',
                waiting,
                active,
                completed,
                failed,
                total: waiting + active + completed + failed
            },
            message: 'Worker está ativo e processando jobs'
        });
    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
