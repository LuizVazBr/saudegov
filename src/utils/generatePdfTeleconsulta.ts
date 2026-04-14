import jsPDF from "jspdf";

export type DocumentType = "Receita" | "Exames" | "Encaminhamento" | "Atestado";

interface PatientInfo {
    nome: string;
    dataNascimento?: string;
    idade?: number | string;
    data_nascimento?: string; // alternate field name from API
}

interface UnitConfig {
    nome?: string;
    cabecalho_logo?: string;
    cabecalho_html?: string;
    rodape_logo?: string;
    rodape_html?: string;
}

/** Carrega uma imagem de uma URL como base64 (funciona com imagens do /public) */
async function loadImageAsBase64(src: string): Promise<string | null> {
    try {
        const resp = await fetch(src);
        const blob = await resp.blob();
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

// Parâmetros de estilo globais
const CYAN = [8, 145, 178] as [number, number, number];
const DARK = [30, 30, 30] as [number, number, number];
const GRAY = [120, 120, 120] as [number, number, number];
const LIGHT_BG = [247, 250, 252] as [number, number, number];
const LINE_COLOR = [210, 225, 235] as [number, number, number];

export const generatePdfTeleconsulta = async (
    docType: DocumentType,
    content: string,
    medicoName: string,
    patientInfo: PatientInfo,
    unitConfig?: UnitConfig,
    signatureUrl?: string
) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR");
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const marginX = 18;
    const pageWidth = doc.internal.pageSize.getWidth();   // 210
    const pageHeight = doc.internal.pageSize.getHeight(); // 297
    const contentWidth = pageWidth - marginX * 2;

    // ── 1. CABEÇALHO ─────────────────────────────────────────────────────────
    // Fundo azul claro no topo
    doc.setFillColor(...CYAN);
    doc.rect(0, 0, pageWidth, 38, "F");

    // Logo Anamnex (canto superior esquerdo)
    const logoB64 = await loadImageAsBase64("/Anamnex-full.png");
    if (logoB64) {
        try {
            doc.addImage(logoB64, "PNG", marginX, 6, 46, 14);
        } catch (e) {
            console.warn("Erro ao renderizar logo:", e);
        }
    }

    // Título do documento no canto direito
    const docLabel = docType === "Receita" ? "RECEITUÁRIO" :
        docType === "Exames" ? "SOLICITAÇÃO DE EXAMES" :
            docType === "Atestado" ? "ATESTADO MÉDICO" : "ENCAMINHAMENTO";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(docLabel, pageWidth - marginX, 18, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(200, 240, 255);
    doc.text(`Telemedicina Digital`, pageWidth - marginX, 24, { align: "right" });

    // ── 2. BLOCO DO PACIENTE ──────────────────────────────────────────────────
    // Caixa com fundo levemente azulado
    doc.setFillColor(...LIGHT_BG);
    doc.setDrawColor(...LINE_COLOR);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, 44, contentWidth, 32, 2, 2, "FD");

    // "DADOS DO PACIENTE" label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...CYAN);
    doc.text("DADOS DO PACIENTE", marginX + 4, 50);

    // Linha fina separadora
    doc.setDrawColor(...LINE_COLOR);
    doc.line(marginX + 4, 52, marginX + contentWidth - 4, 52);

    // Dados
    const patName = (patientInfo.nome || "Não identificado").toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text(patName, marginX + 4, 60);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);

    const rawDob = patientInfo.dataNascimento || (patientInfo as any).data_nascimento;
    const dobFormatted = rawDob
        ? new Date(rawDob).toLocaleDateString("pt-BR", { timeZone: "UTC" })
        : "Não informada";
    const idadeStr = patientInfo.idade != null ? `${patientInfo.idade} anos` : "—";

    // Linha 1: Nascimento + Idade
    doc.text(`Nascimento: ${dobFormatted}   |   Idade: ${idadeStr}`, marginX + 4, 68);

    // Linha 2: Data de emissão (lado direito)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...CYAN);
    doc.text(`Emissão: ${dateStr} às ${timeStr}`, pageWidth - marginX - 4, 60, { align: "right" });

    // ── 3. TÍTULO INTERNO (linha "—— Receituário ——") ─────────────────────────
    let y = 84;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);

    // ── 4. CONTEÚDO PRINCIPAL ─────────────────────────────────────────────────
    // Divide o conteúdo por linhas e formata cada medicamento individualmente
    const lines = content.split("\n").map(l => l.trim()).filter(l => l.length > 0);

    for (const line of lines) {
        if (y > pageHeight - 60) {
            doc.addPage();
            y = 20;
        }

        if (line.startsWith("-")) {
            // É um medicamento — extrai nome, dosagem e qtd
            // Exemplo: "- DIPIRONA (500mg) - Qtd: 1 caixa"
            const medContent = line.replace(/^-\s*/, "");
            const qtdMatch = medContent.match(/(-\s*Qtd:\s*)(.+)$/i);
            const qtd = qtdMatch ? qtdMatch[2].trim() : null;
            const medMain = qtdMatch ? medContent.replace(qtdMatch[0], "").trim() : medContent;
            const nameMatch = medMain.match(/^([^(]+)/);
            const dosagemMatch = medMain.match(/\(([^)]+)\)/);

            const medNome = nameMatch ? nameMatch[1].trim() : medMain;
            const medDosagem = dosagemMatch ? dosagemMatch[1] : null;

            // Box para o medicamento
            doc.setFillColor(...LIGHT_BG);
            doc.setDrawColor(...LINE_COLOR);
            doc.roundedRect(marginX, y, contentWidth, 22, 2, 2, "FD");

            // Ícone indicador (barra lateral ciano)
            doc.setFillColor(...CYAN);
            doc.rect(marginX, y, 3, 22, "F");

            // Nome do medicamento
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(...DARK);
            doc.text(medNome.toUpperCase(), marginX + 7, y + 8);

            // Dosagem
            if (medDosagem) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(...CYAN);
                doc.text(`Dosagem: ${medDosagem}`, marginX + 7, y + 14);
            }

            // Quantidade (lado direito)
            if (qtd) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(...GRAY);
                doc.text(`Qtd: ${qtd}`, pageWidth - marginX - 4, y + 8, { align: "right" });
            }

            y += 26;
        } else if (line.toLowerCase().startsWith("uso:") || line.toLowerCase().startsWith("uso ")) {
            // Linha de instruções de uso
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.setTextColor(...GRAY);
            const wrappedLine = doc.splitTextToSize(`  ${line}`, contentWidth - 10);
            doc.text(wrappedLine, marginX + 7, y);
            y += wrappedLine.length * 5 + 4;
        } else {
            // Texto genérico (obs, etc.)
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(...DARK);
            const wrapped = doc.splitTextToSize(line, contentWidth);
            doc.text(wrapped, marginX, y);
            y += wrapped.length * 6 + 2;
        }
    }

    // ── 5. ASSINATURA ─────────────────────────────────────────────────────────
    const sigY = pageHeight - 52;

    doc.setDrawColor(...LINE_COLOR);
    doc.setLineWidth(0.3);
    doc.line(marginX, sigY - 2, pageWidth - marginX, sigY - 2);

    // Imagem da assinatura
    if (signatureUrl) {
        try {
            const sigB64 = await loadImageAsBase64(signatureUrl);
            if (sigB64) {
                doc.addImage(sigB64, "PNG", pageWidth / 2 - 25, sigY - 28, 50, 22);
            }
        } catch (e) {
            console.warn("Erro ao renderizar assinatura:", e);
        }
    }

    // Linha da assinatura
    const lineCenter = pageWidth / 2;
    doc.setDrawColor(...DARK);
    doc.setLineWidth(0.5);
    doc.line(lineCenter - 40, sigY + 14, lineCenter + 40, sigY + 14);

    // Nome do médico
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text(`Dr(a). ${medicoName}`, lineCenter, sigY + 20, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text("Médico Responsável — Assinatura Digital", lineCenter, sigY + 26, { align: "center" });

    // ── 6. RODAPÉ ─────────────────────────────────────────────────────────────
    doc.setFillColor(...CYAN);
    doc.rect(0, pageHeight - 14, pageWidth, 14, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    const authId = Math.random().toString(36).substring(2, 10).toUpperCase();
    doc.text(`Documento gerado via Anamnex Telemedicina  •  Código: ${authId}`, pageWidth / 2, pageHeight - 6, { align: "center" });

    if (unitConfig?.rodape_html) {
        doc.setFontSize(7);
        doc.setTextColor(200, 240, 255);
        const footerText = unitConfig.rodape_html.replace(/<[^>]*>/g, "");
        doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: "center" });
    }

    // ── 7. SALVA ─────────────────────────────────────────────────────────────
    const safeName = (patientInfo.nome || "paciente").replace(/\s+/g, "_").toLowerCase();
    doc.save(`${docType.toLowerCase()}_${safeName}_${dateStr.replace(/\//g, "-")}.pdf`);
};

export const generatePdfBlob = async (
    docType: DocumentType,
    content: string,
    medicoName: string,
    patientInfo: PatientInfo,
    unitConfig?: UnitConfig,
    signatureUrl?: string
): Promise<Blob> => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR");
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const marginX = 18;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - marginX * 2;

    // Cabeçalho
    doc.setFillColor(...CYAN);
    doc.rect(0, 0, pageWidth, 38, "F");

    const logoB64 = await loadImageAsBase64("/Anamnex-full.png");
    if (logoB64) {
        try {
            doc.addImage(logoB64, "PNG", marginX, 6, 46, 14);
        } catch (e) { }
    }

    const docLabel = docType === "Receita" ? "RECEITUÁRIO" :
        docType === "Exames" ? "SOLICITAÇÃO DE EXAMES" :
            docType === "Atestado" ? "ATESTADO MÉDICO" : "ENCAMINHAMENTO";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(docLabel, pageWidth - marginX, 18, { align: "right" });

    // Conteúdo Simplificado (reproduzindo a lógica do generatePdfTeleconsulta)
    // Para simplificar, vou extrair a lógica comum para uma função interna no futuro, 
    // mas agora vou apenas garantir que o código seja funcional.
    
    // Bloco do Paciente
    doc.setFillColor(...LIGHT_BG);
    doc.setDrawColor(...LINE_COLOR);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, 44, contentWidth, 32, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...CYAN);
    doc.text("DADOS DO PACIENTE", marginX + 4, 50);

    const patName = (patientInfo.nome || "Não identificado").toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text(patName, marginX + 4, 60);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    const dob = patientInfo.dataNascimento || (patientInfo as any).data_nascimento || "Não informada";
    doc.text(`Nascimento: ${dob}   |   Idade: ${patientInfo.idade || "—"}`, marginX + 4, 68);

    // Conteúdo
    let y = 84;
    const lines = content.split("\n");
    for (const line of lines) {
        if (y > pageHeight - 60) { doc.addPage(); y = 20; }
        doc.setFontSize(10);
        doc.setTextColor(...DARK);
        const wrapped = doc.splitTextToSize(line, contentWidth);
        doc.text(wrapped, marginX, y);
        y += wrapped.length * 6 + 2;
    }

    // Assinatura
    const sigY = pageHeight - 52;
    doc.line(marginX, sigY - 2, pageWidth - marginX, sigY - 2);
    if (signatureUrl) {
        const sigB64 = await loadImageAsBase64(signatureUrl);
        if (sigB64) doc.addImage(sigB64, "PNG", pageWidth / 2 - 25, sigY - 28, 50, 22);
    }
    doc.setFont("helvetica", "bold");
    doc.text(`Dr(a). ${medicoName}`, pageWidth / 2, sigY + 20, { align: "center" });

    // Rodapé
    doc.setFillColor(...CYAN);
    doc.rect(0, pageHeight - 14, pageWidth, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(`Gerado via Anamnex Telemedicina`, pageWidth / 2, pageHeight - 6, { align: "center" });

    return doc.output("blob");
};
