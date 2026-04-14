// src/queues/expireQueue.ts
import * as path from "path";
import * as dotenv from "dotenv";

// Carrega as variáveis do .env.local antes de qualquer import
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { Pool } from "pg"; // usamos Pool diretamente, não importamos pool de outro arquivo

// Configuração do PostgreSQL usando variáveis de ambiente
const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

// Configuração do Redis usando variáveis de ambiente ou valores fixos
const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || "De}s98}p.Ji9GuVbr97C@",
  maxRetriesPerRequest: null,
});

// Cria a fila de expiração
export const expireQueue = new Queue("expire-cadastro", { connection });

// Worker processando jobs da fila
new Worker(
  "expire-cadastro",
  async (job) => {
    const historicoId = job.data.historicoId;
    const client = await pool.connect();

    try {
      // Verifica o status mais recente do histórico
      const res = await client.query(
        `SELECT status 
         FROM historico_status 
         WHERE historico_id = $1 
         ORDER BY data_cadastro DESC 
         LIMIT 1`,
        [historicoId]
      );

      const statusAtual = res.rows[0]?.status;

      if (statusAtual === "iniciado") {
        // Atualiza para "expirado"
        await client.query(
          `INSERT INTO historico_status (historico_id, status, data_cadastro)
           VALUES ($1, 'expirado', NOW())`,
          [historicoId]
        );

        console.log(`✅ Histórico ${historicoId} expirado!`);
      } else {
        console.log(
          `⏩ Histórico ${historicoId} não expirou, status atual: ${statusAtual}`
        );
      }
    } catch (err) {
      console.error("Erro ao processar job:", err);
    } finally {
      client.release();
    }
  },
  { connection }
);

// Log opcional quando um job entra na fila
expireQueue.on("waiting", (jobId) => console.log(`Job ${jobId} aguardando`));
