const https = require('https');
const fs = require('fs');
const next = require('next');

const port = 3030;
const app = next({ dev: false, conf: { /* suas configs aqui */ } });
const handle = app.getRequestHandler();

const httpsOptions = {
  // Ajuste: Lendo a chave SSL da pasta local "./ssl" em vez do "/root" restrito
  key: fs.readFileSync('./ssl/localhost.key'),
  cert: fs.readFileSync('./ssl/localhost.crt'),
};

// 🛡️ [ESCUDO DE PROTEÇÃO GLOBAL] 🛡️
// Previne que falhas de rede soltas (como o envio de push notifications para IPs mortos gerando ETIMEDOUT)
// derrubem o servidor Node.js/PM2 principal.
process.on('uncaughtException', (err) => {
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
    console.warn(`⚠️ [Ignorado pelo Proteção Global] Erro de conexão de rede externa evitado: ${err.message}`);
  } else {
    console.error('❌ [CRÍTICO] Uncaught Exception não tratada:', err);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.warn(`⚠️ [Ignorado pelo Proteção Global] Promessa rejeitada não tratada:`, reason);
});

app.prepare().then(() => {
  https.createServer(httpsOptions, (req, res) => {
    handle(req, res);
  }).listen(port, () => {
    console.log(`HTTPS server rodando em https://localhost:${port}`);
  });
});
