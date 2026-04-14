import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { File } from "node:buffer";

// Polyfill for File global (required for AI SDKs in Node < 20)
if (typeof globalThis.File === "undefined") {
    (globalThis as any).File = File;
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const audioMed = formData.get("audioMedico") as File | null;
        const audioPac = formData.get("audioPaciente") as File | null;
        const pacienteId = formData.get("pacienteId") as string;

        console.log(`Recebida requisição de transcrição. PacienteID: ${pacienteId}`);
        console.log(`Blob Médico: ${audioMed?.name} (${audioMed?.size} bytes)`);
        console.log(`Blob Paciente: ${audioPac?.name} (${audioPac?.size} bytes)`);

        if (!audioMed || !audioPac) {
            console.error("Arquivos de áudio ausentes na requisição.");
            return NextResponse.json({ success: false, error: "Arquivos de áudio não recebidos." }, { status: 400 });
        }

        // 1. Transcrever áudio do MÉDICO
        const medFile = await fileToTmp(audioMed, "medico");
        const transcriptionMed = await openai.audio.transcriptions.create({
            file: fs.createReadStream(medFile),
            model: "whisper-1",
            response_format: "verbose_json",
            timestamp_granularities: ["segment"],
        });

        // 2. Transcrever áudio do PACIENTE
        const pacFile = await fileToTmp(audioPac, "paciente");
        const transcriptionPac = await openai.audio.transcriptions.create({
            file: fs.createReadStream(pacFile),
            model: "whisper-1",
            response_format: "verbose_json",
            timestamp_granularities: ["segment"],
        });

        // Limpar arquivos temporários
        fs.unlinkSync(medFile);
        fs.unlinkSync(pacFile);

        // 3. Mesclar as transcrições por timestamp com filtro de ruído
        const segmentsMed = (transcriptionMed as any).segments.map((s: any) => ({
            start: s.start,
            text: s.text,
            speaker: "Médico",
            confidence: s.no_speech_prob
        }));

        const segmentsPac = (transcriptionPac as any).segments.map((s: any) => ({
            start: s.start,
            text: s.text,
            speaker: "Paciente",
            confidence: s.no_speech_prob
        })).filter((s: any) => {
            // Filtro para evitar "alucinações" ou ruído quando o paciente está em silêncio
            // Ignora se a probabilidade de silêncio for alta (> 0.6) e o texto for muito curto/comum de ruído
            const noiseTerms = ["you", "obrigado", "thank you", "próximo", "legendas", "transcrição"];
            const isNoise = noiseTerms.includes(s.text.toLowerCase().trim());
            if (s.confidence > 0.6 && isNoise) return false;
            if (s.confidence > 0.9) return false; // Silêncio quase certo
            return true;
        });

        const combined = [...segmentsMed, ...segmentsPac].sort((a, b) => a.start - b.start);
        const fullTranscript = combined.map(s => `${s.speaker}: ${s.text}`).join("\n");

        // 4. Gerar Resumo Estruturado com GPT-4o
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `Você é a "IA do Cliv", uma Inteligência Artificial médica avançada e empática. Sua tarefa é transformar uma transcrição de consulta em uma Anamnese Médica profissional e extrair dados clínicos estruturados.

                    DIRETRIZES DE IDENTIDADE:
                    - Sua identidade é EXCLUSIVAMENTE "IA do Cliv".
                    - NUNCA mencione OpenAI, ChatGPT ou que você é um modelo de linguagem genérico.
                    - Relato direto e clínico, sem metadados de IA.

                    DIRETRIZES CLÍNICAS:
                    1. ANAMNESE: Estruture em Queixa Principal, HDP e HDA. Use terminologia médica rica.
                    2. EXAMES: Extraia o NOME COMPLETO do exame solicitado (ex: "Hemograma Completo", "RM de Crânio"). Nunca retorne apenas números.
                    3. ENCAMINHAMENTOS: Liste a especialidade e o motivo, se houver.
                    4. CONDIÇÕES/TRATAMENTOS: Identifique diagnósticos atuais (CID-10) e tratamentos que o paciente já realiza.

                    O campo "exames" e "encaminhamentos" devem conter LISTAS DE STRINGS com os NOMES dos itens.

                    Retorne obrigatoriamente um JSON:
                    {
                        "relato": "Anamnese estruturada",
                        "sintomas": [{"nome": "Termo", "intensidade": "...", "info": "..."}],
                        "receitas": [{"medicamento": "...", "dosagem": "...", "orientacoes": "..."}],
                        "exames": ["Lista de nomes de exames"],
                        "encaminhamentos": ["Lista de especialidades"],
                        "condicoes": [{"nome": "Doença", "cid": "CID-10"}],
                        "tratamentos_atuais": ["Medicamento ou terapia que o paciente já faz"]
                    }`
                },
                {
                    role: "user",
                    content: `Transcrição da consulta:\n${fullTranscript}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const resultJson = JSON.parse(completion.choices[0].message.content || "{}");

        return NextResponse.json({
            success: true,
            resultado: {
                transcricao: fullTranscript,
                analise: resultJson
            }
        });

    } catch (error: any) {
        console.error("Erro na transcrição/IA:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

async function fileToTmp(file: File, prefix: string): Promise<string> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const tmpDir = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `${prefix}_${uuidv4()}.webm`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}
