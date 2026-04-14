import { NextRequest } from "next/server";
import Redis from "ioredis";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const subscriber = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB || 0),
    tls: process.env.REDIS_TLS === "true" ? {} : undefined,
  });

  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const safeEnqueue = (msg: string) => {
        if (isClosed || req.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(msg));
        } catch (e) {
          isClosed = true;
          console.warn("⚠️ SSE: Falha ao enviar mensagem (Controller fechado)");
        }
      };

      safeEnqueue(": connected\n\n");

      subscriber.subscribe("triage:realtime", (err) => {
        if (err) {
          console.error("Failed to subscribe to triage:realtime:", err);
          if (!isClosed) controller.close();
          isClosed = true;
        }
      });

      subscriber.on("message", (channel, message) => {
        if (channel === "triage:realtime" && !isClosed) {
          safeEnqueue(`data: ${message}\n\n`);
        }
      });

      const heartbeatInterval = setInterval(() => {
        if (isClosed || req.signal.aborted) {
          clearInterval(heartbeatInterval);
          return;
        }
        safeEnqueue(": heartbeat\n\n");
      }, 15000);

      req.signal.onabort = () => {
        isClosed = true;
        clearInterval(heartbeatInterval);
        subscriber.removeAllListeners("message");
        subscriber.quit();
        try { controller.close(); } catch(e) {}
      };
    },
    cancel() {
      isClosed = true;
      subscriber.quit();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
