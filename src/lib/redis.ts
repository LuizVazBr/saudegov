import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  db: Number(process.env.REDIS_DB || 0),
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  lazyConnect: false,             // conecta automaticamente
  keepAlive: 10000,               // mantém conexão viva
  connectTimeout: 10000,          // tempo máximo de conexão
  maxRetriesPerRequest: null,     // OBRIGATÓRIO para BullMQ
  retryStrategy(times) {
    if (times > 10) return null;
    return Math.min(times * 1000, 30000);
  }
});

redis.on('connect', () => console.log('✅ Redis conectado com sucesso.'));
redis.on('error', (err) => console.error('❌ Erro no Redis:', err));

export async function invalidateTriageCache() {
  try {
    let count = 0;
    const stream = redis.scanStream({
      match: "cliv:triage:list:*",
      count: 100
    });

    for await (const keys of stream) {
      if (keys.length > 0) {
        await redis.del(...keys);
        count += keys.length;
      }
    }
    
    if (count > 0) {
      console.log(`🧹 Cache de triagem invalidado: ${count} chaves removidas.`);
    }
  } catch (err) {
    console.warn("Erro ao invalidar cache de triagem:", err);
  }
}


