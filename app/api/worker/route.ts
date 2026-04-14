import { NextResponse } from 'next/server';
import { getNotificationWorker } from '@/lib/queue/notificationWorker';

export async function GET() {
    try {
        // Força a inicialização do worker
        const worker = getNotificationWorker();

        return NextResponse.json({
            status: 'active',
            message: 'Notification worker is running and processing jobs',
            queueName: 'push-notifications'
        });
    } catch (error: any) {
        console.error('Erro ao iniciar worker:', error);
        return NextResponse.json({
            status: 'error',
            message: error.message
        }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
