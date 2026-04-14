"use client";

import { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import toast, { Toaster } from "react-hot-toast";
import { FiFileText, FiDownload, FiCalendar, FiBarChart2 } from "react-icons/fi";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function GerarRelatorio() {
    const { tema } = useTheme();

    const [loading, setLoading] = useState(false);
    const [periodo, setPeriodo] = useState<"hoje" | "semana" | "15dias" | "custom">("semana");
    const [dataInicio, setDataInicio] = useState("");
    const [dataFim, setDataFim] = useState("");
    const [estatisticas, setEstatisticas] = useState<any>(null);

    const calcularPeriodo = () => {
        const hoje = new Date();
        let inicio, fim;

        switch (periodo) {
            case "hoje":
                inicio = startOfDay(hoje);
                fim = endOfDay(hoje);
                break;
            case "semana":
                inicio = startOfDay(subDays(hoje, 7));
                fim = endOfDay(hoje);
                break;
            case "15dias":
                inicio = startOfDay(subDays(hoje, 15));
                fim = endOfDay(hoje);
                break;
            case "custom":
                if (!dataInicio || !dataFim) {
                    toast.error("Selecione as datas de início e fim");
                    return null;
                }
                inicio = startOfDay(new Date(dataInicio));
                fim = endOfDay(new Date(dataFim));
                break;
        }

        return {
            dataInicio: inicio.toISOString(),
            dataFim: fim.toISOString()
        };
    };

    const buscarEstatisticas = async () => {
        const datas = calcularPeriodo();
        if (!datas) return;

        setLoading(true);
        try {
            const res = await fetch("/api/relatorios/estatisticas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(datas)
            });

            const data = await res.json();

            if (data.success) {
                setEstatisticas(data.estatisticas);
                toast.success("✅ Estatísticas carregadas!");
            } else {
                toast.error("❌ Erro ao carregar estatísticas");
            }
        } catch (error) {
            console.error(error);
            toast.error("❌ Erro de conexão");
        } finally {
            setLoading(false);
        }
    };

    const gerarPDF = () => {
        if (!estatisticas) {
            toast.error("Carregue as estatísticas primeiro");
            return;
        }

        const doc = new jsPDF();
        const datas = calcularPeriodo();

        // Adicionar logo no canto superior esquerdo
        try {
            const logoImg = new Image();
            logoImg.src = '/Anamnex-Cliv.png';
            doc.addImage(logoImg, 'PNG', 15, 8, 30, 12);
        } catch (e) {
            console.warn('Erro ao carregar logo:', e);
        }

        // Cabeçalho
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(37, 99, 235);
        doc.text("Relatório de Atendimentos", 105, 20, { align: "center" });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(
            `Período: ${format(new Date(datas!.dataInicio), "dd/MM/yyyy", { locale: ptBR })} a ${format(new Date(datas!.dataFim), "dd/MM/yyyy", { locale: ptBR })}`,
            105,
            28,
            { align: "center" }
        );

        // Linha divisória
        doc.setDrawColor(200);
        doc.line(20, 32, 190, 32);

        let yPos = 40;

        // 1. Resumo Geral
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Resumo geral", 20, yPos);
        yPos += 8;

        const resumoData = [
            ["Total de atendimentos", estatisticas.totalAtendimentos.toString()],
            ["Total de pacientes", estatisticas.totalPacientes?.toString() || "0"],
            ["Relação paciente/atendimentos", `${(estatisticas.totalAtendimentos / (estatisticas.totalPacientes || 1)).toFixed(1)} atend/paciente`],
            ["Pacientes 60+", estatisticas.pacientes60Plus.toString()],
            ["Tempo médio de atendimento", `${estatisticas.tempoMedioMinutos} min`],
            ["Tempo médio de transcrição", `${estatisticas.tempoMedioTranscricao || 0} seg`],
            ["Redução de tempo", `${estatisticas.reducaoTempo}%`],
            ["Classificação mais comum", estatisticas.classificacaoMaisComum || "N/A"],
        ];

        autoTable(doc, {
            startY: yPos,
            head: [["Métrica", "Valor"]],
            body: resumoData,
            theme: "grid",
            headStyles: { fillColor: [37, 99, 235], fontStyle: "bold" },
            margin: { left: 20, right: 20 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;

        // 2. Distribuição por Gênero
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Distribuição por gênero", 20, yPos);
        yPos += 8;

        const generoData = estatisticas.porGenero.map((g: any) => [
            g.sexo || "Não informado",
            g.total.toString(),
            `${((g.total / estatisticas.totalAtendimentos) * 100).toFixed(1)}%`
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [["Gênero", "Total", "Percentual"]],
            body: generoData,
            theme: "striped",
            headStyles: { fillColor: [37, 99, 235], fontStyle: "bold" },
            margin: { left: 20, right: 20 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;

        // 3. Distribuição por Faixa Etária
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Distribuição por faixa etária", 20, yPos);
        yPos += 8;

        const faixaEtariaData = estatisticas.porFaixaEtaria.map((f: any) => [
            f.faixa_etaria,
            f.total.toString(),
            `${((f.total / estatisticas.totalAtendimentos) * 100).toFixed(1)}%`
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [["Faixa Etária", "Total", "Percentual"]],
            body: faixaEtariaData,
            theme: "striped",
            headStyles: { fillColor: [37, 99, 235], fontStyle: "bold" },
            margin: { left: 20, right: 20 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;

        // 4. Classificação de Risco
        if (estatisticas.porClassificacao && estatisticas.porClassificacao.length > 0) {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("Classificação de risco", 20, yPos);
            yPos += 8;

            const classificacaoData = estatisticas.porClassificacao.map((c: any) => [
                c.classificacao || "Não classificado",
                c.total.toString(),
                `${((c.total / estatisticas.totalAtendimentos) * 100).toFixed(1)}%`
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [["Classificação", "Total", "Percentual"]],
                body: classificacaoData,
                theme: "grid",
                headStyles: { fillColor: [220, 38, 38], fontStyle: "bold" },
                margin: { left: 20, right: 20 },
            });

            yPos = (doc as any).lastAutoTable.finalY + 10;
        }

        // 5. Top 5 Localizações
        if (estatisticas.topLocalizacoes && estatisticas.topLocalizacoes.length > 0) {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("Top 5 localizações dos pacientes", 20, yPos);
            yPos += 8;

            const localizacoesData = estatisticas.topLocalizacoes.map((l: any, idx: number) => [
                `${idx + 1}`,
                l.localizacao || "Outros",
                l.total.toString(),
                `${((l.total / estatisticas.totalAtendimentos) * 100).toFixed(1)}%`
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [["#", "Localização", "Total", "Percentual"]],
                body: localizacoesData,
                theme: "grid",
                headStyles: { fillColor: [16, 185, 129], fontStyle: "bold" },
                margin: { left: 20, right: 20 },
            });

            yPos = (doc as any).lastAutoTable.finalY + 10;
        }

        // 6. Tipo de entrada (Digitado vs Por voz)
        if (estatisticas.porTipoEntrada && estatisticas.porTipoEntrada.length > 0) {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("Tipo de entrada dos sintomas", 20, yPos);
            yPos += 8;

            const tipoEntradaData = estatisticas.porTipoEntrada.map((t: any) => [
                t.tipo_entrada || t.tipo,
                t.total.toString(),
                `${((t.total / estatisticas.totalAtendimentos) * 100).toFixed(1)}%`
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [["Tipo", "Total", "Percentual"]],
                body: tipoEntradaData,
                theme: "grid",
                headStyles: { fillColor: [139, 92, 246], fontStyle: "bold" },
                margin: { left: 20, right: 20 },
            });

            yPos = (doc as any).lastAutoTable.finalY + 10;
        }

        // 7. Top 5 Sintomas
        if (estatisticas.topSintomas && estatisticas.topSintomas.length > 0) {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("Top 5 sintomas mais comuns", 20, yPos);
            yPos += 8;

            const sintomasData = estatisticas.topSintomas.map((s: any, idx: number) => [
                `${idx + 1}`,
                s.sintoma || "Não informado",
                s.total.toString()
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [["#", "Sintoma", "Ocorrências"]],
                body: sintomasData,
                theme: "grid",
                headStyles: { fillColor: [37, 99, 235], fontStyle: "bold" },
                margin: { left: 20, right: 20 },
            });
        }

        // Rodapé com marca d'água
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);

            // Adicionar marca d'água no centro de cada página
            try {
                const marcaDaguaImg = new Image();
                marcaDaguaImg.src = '/logo-loading-light.png';
                doc.saveGraphicsState();
                (doc as any).setGState({ opacity: 0.08 });
                doc.addImage(marcaDaguaImg, 'PNG', 55, 100, 100, 100);
                doc.restoreGraphicsState();
            } catch (e) {
                console.warn('Erro ao carregar marca d\'água:', e);
            }

            // Texto do rodapé
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(150);
            doc.text(
                `Página ${i} de ${pageCount} - Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
                105,
                290,
                { align: "center" }
            );
        }

        // Salvar PDF
        const nomeArquivo = `relatorio_atendimentos_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`;
        doc.save(nomeArquivo);
        toast.success(`PDF gerado: ${nomeArquivo}`);
    };

    const periodos = [
        { value: "hoje", label: "Hoje", icon: "📅" },
        { value: "semana", label: "Última Semana", icon: "📊" },
        { value: "15dias", label: "Últimos 15 Dias", icon: "📈" },
        { value: "custom", label: "Período Personalizado", icon: "🗓️" }
    ];

    return (
        <main className={`${tema.mainBg} min-h-screen p-6`}>
            <Toaster position="top-right" />

            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className={`text-3xl font-bold ${tema.textPrimary} mb-2 flex items-center gap-3`}>
                        <FiFileText className="text-blue-500" size={32} />
                        Relatório de atendimentos
                    </h1>
                    <p className={`${tema.textSecondary}`}>
                        Selecione o período para gerar o relatório detalhado em PDF
                    </p>
                </div>

                {/* Seleção de Período */}
                <div className={`p-6 rounded-xl shadow-lg border ${tema.borderColor} bg-white dark:bg-gray-800 mb-6`}>
                    <h2 className={`text-lg font-semibold ${tema.textPrimary} mb-4 flex items-center gap-2`}>
                        <FiCalendar /> Período do Relatório
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        {periodos.map((p) => (
                            <button
                                key={p.value}
                                onClick={() => setPeriodo(p.value as any)}
                                className={`p-4 rounded-lg border-2 transition ${periodo === p.value
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                                    : "border-gray-300 dark:border-gray-600 hover:border-blue-300"
                                    }`}
                            >
                                <div className="text-2xl mb-1">{p.icon}</div>
                                <div className={`font-semibold text-sm ${periodo === p.value ? "text-blue-600" : tema.textPrimary}`}>
                                    {p.label}
                                </div>
                            </button>
                        ))}
                    </div>

                    {periodo === "custom" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label className={`block text-sm font-medium ${tema.textPrimary} mb-2`}>
                                    Data Início
                                </label>
                                <input
                                    type="date"
                                    value={dataInicio}
                                    onChange={(e) => setDataInicio(e.target.value)}
                                    className={`w-full p-3 border rounded-lg ${tema.borderColor} dark:bg-gray-700 dark:text-white`}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium ${tema.textPrimary} mb-2`}>
                                    Data Fim
                                </label>
                                <input
                                    type="date"
                                    value={dataFim}
                                    onChange={(e) => setDataFim(e.target.value)}
                                    className={`w-full p-3 border rounded-lg ${tema.borderColor} dark:bg-gray-700 dark:text-white`}
                                />
                            </div>
                        </div>
                    )}

                    <button
                        onClick={buscarEstatisticas}
                        disabled={loading}
                        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <FiBarChart2 size={20} />
                        {loading ? "Carregando..." : "Carregar Estatísticas"}
                    </button>
                </div>

                {/* Estatísticas */}
                {estatisticas && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className={`p-6 rounded-xl shadow-lg border ${tema.borderColor} bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20`}>
                                <div className="text-4xl mb-2">📊</div>
                                <div className={`text-3xl font-bold ${tema.textPrimary}`}>{estatisticas.totalAtendimentos}</div>
                                <div className={`text-sm ${tema.textSecondary}`}>Total de Atendimentos</div>
                            </div>

                            <div className={`p-6 rounded-xl shadow-lg border ${tema.borderColor} bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20`}>
                                <div className="text-4xl mb-2">👴</div>
                                <div className={`text-3xl font-bold ${tema.textPrimary}`}>{estatisticas.pacientes60Plus}</div>
                                <div className={`text-sm ${tema.textSecondary}`}>Pacientes 60+</div>
                            </div>

                            <div className={`p-6 rounded-xl shadow-lg border ${tema.borderColor} bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20`}>
                                <div className="text-4xl mb-2">⚡</div>
                                <div className={`text-3xl font-bold ${tema.textPrimary}`}>{estatisticas.reducaoTempo}%</div>
                                <div className={`text-sm ${tema.textSecondary}`}>Redução de Tempo</div>
                            </div>

                            <div className={`p-6 rounded-xl shadow-lg border ${tema.borderColor} bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20`}>
                                <div className="text-4xl mb-2">🏥</div>
                                <div className={`text-xl font-bold ${tema.textPrimary}`}>{estatisticas.classificacaoMaisComum || 'N/A'}</div>
                                <div className={`text-sm ${tema.textSecondary}`}>Classificação Mais Comum</div>
                            </div>
                        </div>

                        <button
                            onClick={gerarPDF}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-lg transition flex items-center justify-center gap-2 text-lg shadow-lg"
                        >
                            <FiDownload size={24} />
                            Gerar PDF do Relatório
                        </button>
                    </>
                )}
            </div>
        </main>
    );
}
