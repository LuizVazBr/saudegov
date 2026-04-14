import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import axios from "axios";
import forge from "node-forge";

/**
 * API para Testar conexão real com provedores de Certificado Digital
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const body = await req.json();
        const { tipo, config } = body;

        if (tipo === "PFX") {
            const { pfxBase64, senha } = config;
            if (!pfxBase64 || !senha) {
                return NextResponse.json({ error: "Arquivo PFX e senha são obrigatórios" }, { status: 400 });
            }

            try {
                // Decodificar Base64 para Buffer
                const base64Data = pfxBase64.split(",")[1] || pfxBase64;
                const buffer = Buffer.from(base64Data, "base64");
                const p12Der = buffer.toString("binary");
                
                // Tentar carregar o PKCS#12 usando node-forge (em memória, sem processo externo)
                const p12Asn1 = forge.asn1.fromDer(p12Der);
                const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);
                
                if (p12) {
                    return NextResponse.json({ 
                        success: true, 
                        message: "Arquivo PFX validado com sucesso (In-Memory)!" 
                    });
                }
            } catch (err: any) {
                console.error("Erro PFX node-forge:", err.message);
                return NextResponse.json({ 
                    error: "Senha incorreta ou arquivo PFX inválido." 
                }, { status: 400 });
            }
        }

        if (tipo === "BirdID") {
            const { cpf, senha, clientId, clientSecret } = config;

            if (!clientId || !clientSecret) {
                return NextResponse.json({ error: "Client ID/Secret do BirdID não configurados" }, { status: 400 });
            }

            try {
                const params = new URLSearchParams();
                params.append("grant_type", "password");
                params.append("client_id", clientId.trim());
                params.append("client_secret", clientSecret.trim());
                // Remove apenas pontos e traços, mantém espaços se houver (para nomes de usuário grandes)
                params.append("username", cpf.replace(/[\.\-]/g, "").trim());
                params.append("password", senha);

                const response = await axios.post("https://api.birdid.com.br/oauth/token", params, {
                    headers: { "Content-Type": "application/x-www-form-urlencoded" }
                });

                if (response.data.access_token) {
                    return NextResponse.json({ success: true, message: "Conexão com BirdID estabelecida!" });
                }
            } catch (err: any) {
                console.error("Erro BirdID completo:", err.response?.data || err.message);
                let msg = "Erro ao conectar com BirdID.";
                if (err.response && err.response.data) {
                    msg = `BirdID retornou: ${JSON.stringify(err.response.data)}`;
                } else if (err.message) {
                    msg = `Erro na requisição: ${err.message}`;
                }
                return NextResponse.json({ error: msg }, { status: 400 });
            }
        }

        if (tipo === "Vidaas") {
            const { cpf, senha, clientId, clientSecret } = config;

            if (!clientId || !clientSecret) {
                return NextResponse.json({ error: "Client ID/Secret do Vidaas não configurados" }, { status: 400 });
            }

            try {
                // Vidaas (Valid) costuma seguir padrão similar ao BirdID ou PSC
                // Ajustar URL conforme documentação final do usuário
                const params = new URLSearchParams();
                params.append("grant_type", "password");
                params.append("client_id", clientId);
                params.append("client_secret", clientSecret);
                // Remove apenas pontos e traços, mantém espaços se houver (para nomes de usuário grandes)
                params.append("username", cpf.replace(/[\.\-]/g, "").trim());
                params.append("password", senha);

                const response = await axios.post("https://api.vidaas.com.br/oauth/token", params, {
                    headers: { "Content-Type": "application/x-www-form-urlencoded" }
                });

                if (response.data.access_token) {
                    return NextResponse.json({ success: true, message: "Conexão com Vidaas estabelecida!" });
                }
            } catch (err: any) {
                const msg = err.response?.data?.error_description || err.response?.data?.error || "Erro ao conectar com Vidaas";
                return NextResponse.json({ error: msg }, { status: 400 });
            }
        }

        if (tipo === "imagem") {
            return NextResponse.json({ success: true, message: "Carimbo de assinatura configurado!" });
        }

        return NextResponse.json({ error: "Tipo de assinatura não suportado para teste" }, { status: 400 });

    } catch (err: any) {
        console.error("Erro no teste de assinatura:", err);
        return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
    }
}
