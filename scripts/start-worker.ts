#!/usr/bin/env tsx
/**
 * Script para iniciar o Worker de Notificações
 * 
 * Uso:
 *   npm run worker
 * 
 * Em produção (PM2):
 *   pm2 start npm --name "notification-worker" -- run worker
 */

import '../src/lib/queue/notificationWorker';

console.log('🚀 Worker de notificações iniciado');
console.log('📡 Aguardando jobs na fila "push-notifications"...');
console.log('⏹️  Pressione CTRL+C para parar');

// Mantém o processo rodando
process.on('SIGINT', () => {
    console.log('\n👋 Encerrando worker...');
    process.exit(0);
});
