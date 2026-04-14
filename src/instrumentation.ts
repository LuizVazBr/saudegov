export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        try {
            const dns = await import('node:dns');
            if (dns.setDefaultResultOrder) {
                dns.setDefaultResultOrder('ipv4first');
                console.log('✅ DNS: Ordem IPv4 forçada com sucesso (ipv4first).');
            }

            // 🛡️ [ESCUDO DE PROTEÇÃO GLOBAL] 🛡️
            process.on('uncaughtException', (err: any) => {
                if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
                    console.warn(`⚠️ [Ignorado pelo Proteção Global] Erro de rede externa (uncaughtException): ${err.message}`);
                } else {
                    console.error('❌ [CRÍTICO] Uncaught Exception:', err);
                }
            });

            process.on('unhandledRejection', (reason: any, promise) => {
                console.warn(`⚠️ [Ignorado pelo Proteção Global] Promessa rejeitada não tratada:`, reason);
            });

        } catch (e) {
            console.warn('⚠️ Falha ao configurar DNS/Escudo:', e);
        }
    }
}
