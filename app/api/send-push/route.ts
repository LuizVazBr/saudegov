import webpush from 'web-push';
import { getSubscriptions } from '@/lib/subscriptions'; // função correta

webpush.setVapidDetails(
  'mailto:clivtecnologia@gmail.com',
  process.env.VAPID_PUBLIC!,
  process.env.VAPID_PRIVATE!
);

export async function POST(req: Request) {
  // Payload que será enviado para o SW
  const payload = JSON.stringify({
    title: '🚨 Nova triagem',
    body: 'Você tem um novo resultado',
    url: '/triagem'
  });

  // Buscar todas as subscriptions
  const subscriptions = await getSubscriptions(); // retorna array de rows do PostgreSQL

  // Enviar push para cada subscription em paralelo
  const results = await Promise.allSettled(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        },
        payload
      );
    } catch (err: any) {
      const isGone = err.statusCode === 410 || err.statusCode === 404;
      const isTimeout = err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
      
      if (isGone || isTimeout) {
        console.warn(`🧹 Endpoint morto detectado (${err.code || err.statusCode}). Removendo: ${sub.endpoint}`);
        const { deleteSubscriptionByEndpoint } = await import('@/lib/subscriptions');
        await deleteSubscriptionByEndpoint(sub.endpoint);
      } else {
        console.error('❌ Erro ao enviar push:', err.message || err);
      }
    }
  }));

  const failedCount = results.filter(r => r.status === 'rejected').length;
  console.log(`🚀 Ciclo de push finalizado. Sucesso em ${results.length - failedCount}/${results.length} envios.`);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
