// Worker de notificações - Versão JavaScript puro
require('../src/lib/queue/notificationWorker.ts');

console.log('🚀 Worker de notificações iniciado');
console.log('📡 Aguardando jobs na fila "push-notifications"...');
console.log('⏹️  Pressione CTRL+C para parar');

// Mantém o processo rodando
process.on('SIGINT', () => {
    console.log('\n👋 Encerrando worker...');
    process.exit(0);
});
