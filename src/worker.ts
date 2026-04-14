import * as path from 'path';
import * as dotenv from 'dotenv';

// Ajuste o path para onde seu .env.local está na raiz
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Import logic here to ensure workers start
import "./queues/expireQueue";
import "./lib/queue/notificationWorker";

console.log('👷 Worker rodando e aguardando jobs...');
