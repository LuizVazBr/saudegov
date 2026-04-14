import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) {
        return NextResponse.json({ error: "Query não informada" }, { status: 400 });
    }

    try {
        // Lista de User-Agents para evitar bloqueio
        const uas = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        ];
        const randomUA = uas[Math.floor(Math.random() * uas.length)];

        // Endpoint público da ANVISA (Consultas)
        const url = `https://consultas.anvisa.gov.br/api/consulta/medicamento/produtos?count=20&filter%5BnomeProduto%5D=${encodeURIComponent(query)}&page=1`;

        const response = await fetch(url, {
            headers: {
                "Authorization": "Guest",
                "User-Agent": randomUA,
                "Referer": "https://consultas.anvisa.gov.br/",
                "Accept": "application/json, text/plain, */*",
                "X-Requested-With": "XMLHttpRequest"
            }
        });

        if (!response.ok) {
            console.error("Erro ANVISA API:", response.status, response.statusText);
            // Retorna um array vazio em vez de erro para não quebrar o .map no frontend
            return NextResponse.json([]);
        }

        const data = await response.json();

        // Mapeia para o formato esperado pelo frontend
        const result = (data.content || []).map((item: any) => ({
            id_anvisa: item.numeroRegistro,
            nome: item.nomeProduto,
            principio_ativo: item.principioAtivo,
            fabricante: item.fabricante?.razaoSocial || "",
            // Tenta extrair uma dosagem simples da 'apresentacao'
            dosagem: extractDosage(item.apresentacao),
            apresentacao_completa: item.apresentacao,
            situacao: item.situacao
        }));

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Remote search error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function extractDosage(text: string): string {
    if (!text) return "";
    // Tenta pegar a primeira parte antes do primeiro ';'
    const parts = text.split(';');
    const firstPart = parts[0];

    // Tenta extrair padrões comuns de dosagem (ex: 500mg, 10mg/ml)
    const dosageMatch = firstPart.match(/(\d+\s*(mg|g|ml|mcg|ui|percent|%))/i);
    return dosageMatch ? dosageMatch[0] : firstPart.trim();
}
