import { Pool } from "pg";

// Configuração do PostgreSQL
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: Number(process.env.PG_PORT || 5432),
});

// Adicionar ou atualizar inscrição com sanitização básica
export async function addSubscription(usuarioId: string, sub: any) {
  if (!sub.endpoint || !sub.endpoint.startsWith('https://')) {
    console.warn(`⚠️ [Sanitização] Endpoint de push inválido ou inseguro rejeitado para usuarioId ${usuarioId}: ${sub.endpoint}`);
    return;
  }
  const keys = sub.keys || {};
  const client = await pool.connect();
  try {
    // Remove inscrição antiga, se existir
    await client.query(
      `DELETE FROM subscriptions WHERE usuario_id = $1`,
      [usuarioId]
    );

    // Insere a nova inscrição
    await client.query(
      `INSERT INTO subscriptions (usuario_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)`,
      [usuarioId, sub.endpoint, keys.p256dh, keys.auth]
    );

    console.log(`Inscrição atualizada para o usuarioId: ${usuarioId}`);
  } finally {
    client.release();
  }
}

// Buscar inscrições
export async function getSubscriptions(usuarioId?: string, limit = 1000, offset = 0) {
  const client = await pool.connect();
  try {
    if (usuarioId) {
      const { rows } = await client.query(
        `SELECT * FROM subscriptions 
         WHERE usuario_id = $1
         ORDER BY id ASC
         LIMIT $2 OFFSET $3`,
        [usuarioId, limit, offset]
      );
      return rows;
    } else {
      const { rows } = await client.query(
        `SELECT * FROM subscriptions
         ORDER BY id ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      return rows;
    }
  } finally {
    client.release();
  }
}

// Remover inscrição específica (para limpeza de endpoints mortos)
export async function deleteSubscriptionByEndpoint(endpoint: string) {
  const client = await pool.connect();
  try {
    await client.query(
      `DELETE FROM subscriptions WHERE endpoint = $1`,
      [endpoint]
    );
    console.log(`🧹 [Limpeza] Inscrição removida: ${endpoint}`);
  } catch (err) {
    console.error(`❌ Erro ao remover inscrição morta:`, err);
  } finally {
    client.release();
  }
}
