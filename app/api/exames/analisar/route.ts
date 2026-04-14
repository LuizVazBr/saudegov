import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "API key não configurada" }, { status: 500 });
    }

    const { exameId, imagemBase64 } = await request.json();

    if (!exameId || !imagemBase64) {
        return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    try {
        // Prepara a imagem para a API do OpenAI
        const imageData = imagemBase64.startsWith("data:")
            ? imagemBase64
            : `data:image/png;base64,${imagemBase64}`;

        console.log("🤖 Iniciando análise do exame:", exameId);

        // Chama OpenAI Vision API para análise
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Você é um assistente especializado em análise de exames médicos.
Analise a imagem do exame e extraia:
1. Tipo de exame (hemograma, glicemia, etc.)
2. Valores encontrados com suas unidades
3. Valores de referência (se visíveis)
4. Identificação de valores fora da faixa normal

Responda APENAS em JSON válido no seguinte formato:
{
  "tipo_exame": "string",
  "valores": [
    {
      "parametro": "string",
      "valor": "string",
      "unidade": "string",
      "referencia": "string",
      "status": "normal" | "alto" | "baixo" | "indeterminado"
    }
  ],
  "observacoes": "string com observações gerais"
}`
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Analise este exame médico e extraia os valores conforme solicitado."
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: imageData
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1500,
                temperature: 0,
                response_format: { type: "json_object" }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Erro de Processamento:", response.status, errorText);
            throw new Error(`Erro de API: ${response.status}`);
        }

        const data = await response.json();
        const analise = JSON.parse(data.choices[0].message.content);

        console.log("✅ Análise concluída:", JSON.stringify(analise, null, 2));

        // Salva a análise no banco de dados
        const client = await pool.connect();
        await client.query(
            `UPDATE exames SET analise_ia = $1 WHERE id = $2`,
            [JSON.stringify(analise), exameId]
        );
        client.release();

        console.log("💾 Análise salva no banco para exame:", exameId);

        return NextResponse.json({ success: true, analise });
    } catch (error: any) {
        console.error("❌ Erro na análise do exame:", error);
        return NextResponse.json(
            { error: `Erro ao analisar exame: ${error.message}` },
            { status: 500 }
        );
    }
}
