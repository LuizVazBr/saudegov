// clearFailedJobs.ts
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || "De}s98}p.Ji9GuVbr97C@",
  maxRetriesPerRequest: null,
});

const expireQueue = new Queue("expire-cadastro", { connection: connection as any });

async function limparFailed() {
  console.log("🧹 Limpando jobs failed...");
  const failedJobs = await expireQueue.getFailed();
  console.log(`Encontrados ${failedJobs.length} jobs failed`);

  for (const job of failedJobs) {
    await job.remove();
    console.log(`Removido job ${job.id}`);
  }

  console.log("✅ Todos jobs failed foram removidos");
  process.exit(0);
}

limparFailed().catch((err) => {
  console.error("Erro ao limpar jobs failed:", err);
  process.exit(1);
});
