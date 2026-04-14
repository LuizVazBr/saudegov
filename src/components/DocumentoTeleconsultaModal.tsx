"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Stethoscope, FilePlus, X, Send, Plus, Trash2, Search, Loader2 } from "lucide-react";
import { FiDownload, FiDatabase, FiCheckCircle } from "react-icons/fi";
import { DocumentType } from "@/utils/generatePdfTeleconsulta";

interface DocumentoTeleconsultaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (docType: DocumentType, content: string, extraData?: any) => void;
    pacienteId?: string;
}

export default function DocumentoTeleconsultaModal({
    isOpen,
    onClose,
    onSend,
    pacienteId
}: DocumentoTeleconsultaModalProps) {
    const [docType, setDocType] = useState<DocumentType>("Receita");
    const [content, setContent] = useState("");

    // Estados para o gerador de receita
    const [isAdicionandoMed, setIsAdicionandoMed] = useState(false);
    const [medNome, setMedNome] = useState("");
    const [medDosagem, setMedDosagem] = useState("");
    const [medDuracao, setMedDuracao] = useState("");
    const [medHorarios, setMedHorarios] = useState("");
    const [medQuantidade, setMedQuantidade] = useState("");

    // Autocomplete Medicamentos
    const [sugestoes, setSugestoes] = useState<{ nome: string; dosagem?: string; anvisa?: boolean; original?: any }[]>([]);
    const [buscandoMeds, setBuscandoMeds] = useState(false);
    const [buscandoAnvisa, setBuscandoAnvisa] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchTimeout = useRef<any>(null);

    // Estados para Exames
    const [isAdicionandoExame, setIsAdicionandoExame] = useState(false);
    const [exameInput, setExameInput] = useState("");
    const [listaExames, setListaExames] = useState<string[]>([]);

    // Estados para Atestado
    const [atestadoDias, setAtestadoDias] = useState("");

    // Dados para o PDF
    const [patientInfo, setPatientInfo] = useState<any>(null);
    const [unitConfig, setUnitConfig] = useState<any>(null);
    const [professionalConfig, setProfessionalConfig] = useState<any>(null);

    useEffect(() => {
        if (isOpen && pacienteId) {
            fetchPatientData();
            fetchProfessionalData();
        }
    }, [isOpen, pacienteId]);

    const fetchPatientData = async () => {
        try {
            const res = await fetch(`/api/paciente/resumo?pacienteId=${pacienteId}`);
            const data = await res.json();
            setPatientInfo({
                nome: data.nome,
                dataNascimento: data.data_nascimento,
                idade: data.idade
            });
        } catch (e) {
            console.error("Erro ao buscar dados do paciente:", e);
        }
    };

    const fetchProfessionalData = async () => {
        // Dados profissionais serão lidos da sessão ao gerar o PDF
        // endpoint /api/perfil/atualizar só aceita POST, não está sendo usado aqui
    };

    const handleSearchMed = async (val: string) => {
        setMedNome(val);
        if (val.length < 2) {
            setSugestoes([]);
            return;
        }

        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        searchTimeout.current = setTimeout(async () => {
            setBuscandoMeds(true);
            try {
                const res = await fetch(`/api/medicamentos/search?q=${encodeURIComponent(val)}`);
                const data = await res.json();
                setSugestoes(data.map((m: any) => ({ ...m, anvisa: false })));
            } catch (e) {
                console.error(e);
            } finally {
                setBuscandoMeds(false);
            }
        }, 300);
    };

    const buscarAnvisa = async () => {
        if (!medNome || medNome.length < 3) return;
        setBuscandoAnvisa(true);
        setSugestoes([]); // Limpa para mostrar o loading
        try {
            const resp = await fetch(`/api/medicamentos/remote-search?q=${encodeURIComponent(medNome)}`);
            const data = await resp.json();
            setSugestoes(data.map((m: any) => ({ ...m, anvisa: true })));
        } catch (error) {
            console.error(error);
        } finally {
            setBuscandoAnvisa(false);
        }
    };

    const selecionarMedicamento = async (s: any) => {
        if (s.anvisa) {
            try {
                const resp = await fetch('/api/medicamentos/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome: s.nome,
                        dosagem: s.dosagem,
                        principio_ativo: s.principio_ativo,
                        fabricante: s.fabricante,
                        descricao: `Importado da ANVISA (${s.id_anvisa || ''})`
                    })
                });
                const data = await resp.json();
                if (data.success) {
                    console.log("Medicamento importado com sucesso");
                }
            } catch (err) {
                console.error("Erro ao importar da anvisa:", err);
            }
        }

        setMedNome(s.nome);
        if (s.dosagem) setMedDosagem(s.dosagem);
        setSugestoes([]);
    };

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        let finalContent = content;

        if (docType === "Exames") {
            const examesStr = listaExames.length > 0
                ? "EXAMES SOLICITADOS:\n" + listaExames.map(ex => `- ${ex.toUpperCase()}`).join("\n") + "\n\n"
                : "";
            finalContent = examesStr + (content.trim() ? `OBSERVAÇÕES:\n${content}` : "");
        } else if (docType === "Atestado") {
            const diasStr = atestadoDias ? `Atesto para os devidos fins que o paciente necessita de ${atestadoDias} dias de afastamento.\n\n` : "";
            finalContent = diasStr + (content.trim() ? `OBSERVAÇÕES:\n${content}` : "");
        }

        if (!finalContent.trim()) return;

        // Passa os dados estruturados para quem chama gerar o PDF corretamente
        onSend(docType, finalContent, {
            patientInfo,
            unitConfig,
            professionalConfig
        });

        // Reset states
        setContent("");
        setListaExames([]);
        setAtestadoDias("");
        setIsAdicionandoMed(false);
        setIsAdicionandoExame(false);
        onClose();
    };

    const handleAddMedicamento = () => {
        if (!medNome.trim()) return;
        const medText = `\n- ${medNome.toUpperCase()} ${medDosagem ? `(${medDosagem})` : ''} ${medQuantidade ? `- Qtd: ${medQuantidade}` : ''}\n  Uso: ${medHorarios}. Duração: ${medDuracao}\n`;
        setContent(prev => prev + medText);
        setIsAdicionandoMed(false);
        setMedNome("");
        setMedDosagem("");
        setMedDuracao("");
        setMedHorarios("");
        setMedQuantidade("");
        setSugestoes([]);
    };

    const handleAddExame = () => {
        if (!exameInput.trim()) return;
        setListaExames(prev => [...prev, exameInput]);
        setExameInput("");
        setIsAdicionandoExame(false);
    };

    const handleRemoveExame = (index: number) => {
        setListaExames(prev => prev.filter((_, i) => i !== index));
    };

    const tabs: { id: DocumentType; label: string; icon: any }[] = [
        { id: "Receita", label: "Receita", icon: FileText },
        { id: "Exames", label: "Exames", icon: Stethoscope },
        { id: "Atestado", label: "Atestado", icon: FilePlus },
        { id: "Encaminhamento", label: "Guia", icon: FileText },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-cyan-600" />
                        Emitir Documento
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 flex flex-col no-scrollbar">

                    {/* Tabs */}
                    <div className="flex bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto no-scrollbar">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = docType === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setDocType(tab.id)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${isActive
                                        ? "bg-white text-cyan-700 shadow-sm"
                                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                                        }`}
                                >
                                    <Icon className={`w-4 h-4 ${isActive ? "text-cyan-600" : ""}`} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    <form id="document-form" onSubmit={handleSubmit} className="flex-1 flex flex-col">

                        {/* Assistente de Prescrição (Só aparece na Receita) */}
                        {docType === "Receita" && (
                            <div className="mb-4">
                                {!isAdicionandoMed ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsAdicionandoMed(true)}
                                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-cyan-300 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-medium rounded-xl transition"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Adicionar medicamento
                                    </button>
                                ) : (
                                    <div className="bg-cyan-50 p-4 rounded-xl border border-cyan-200 space-y-3">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="text-sm font-bold text-cyan-800">Novo Medicamento</h3>
                                            <button type="button" onClick={() => setIsAdicionandoMed(false)} className="text-gray-400 hover:text-red-500">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Medicamento (Ex: Dipirona)</label>
                                            <div className="relative">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={medNome}
                                                    onChange={e => handleSearchMed(e.target.value)}
                                                    onFocus={() => setShowDropdown(true)}
                                                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-gray-800"
                                                    placeholder="Digite o nome..."
                                                />
                                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                                {buscandoMeds && (
                                                    <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-cyan-600 animate-spin" />
                                                )}
                                            </div>

                                            {/* Sugestões Autocomplete */}
                                            {showDropdown && medNome.length >= 2 && (sugestoes.length > 0 || buscandoMeds || buscandoAnvisa || medNome.length >= 3) && (
                                                <div
                                                    className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-y-auto"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                >
                                                    {sugestoes.map((s, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => selecionarMedicamento(s)}
                                                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 transition-colors border-b border-gray-100 last:border-0"
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold">{s.nome}</span>
                                                                    {s.dosagem && <span className="text-xs text-gray-500">{s.dosagem}</span>}
                                                                    {s.anvisa && <span className="text-[10px] text-orange-600 font-medium">✨ Sugestão da ANVISA</span>}
                                                                </div>
                                                                {s.anvisa && <FiDownload className="text-orange-400 w-4 h-4 mt-1" />}
                                                            </div>
                                                        </button>
                                                    ))}

                                                    {/* Botão de Busca na ANVISA se houver poucos resultados locais */}
                                                    {!buscandoAnvisa && medNome.length >= 3 && (
                                                        <button
                                                            type="button"
                                                            onClick={buscarAnvisa}
                                                            className="w-full px-4 py-3 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 font-medium flex items-center justify-center gap-2 border-t border-blue-200"
                                                        >
                                                            <FiDatabase className="w-4 h-4" />
                                                            {sugestoes.length > 0 ? "Não encontrou? Buscar na base da ANVISA" : "Buscar na base da ANVISA"}
                                                        </button>
                                                    )}

                                                    {buscandoAnvisa && (
                                                        <div className="p-4 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                                                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                            Consultando base nacional...
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-1">
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Dosagem (Ex: 500mg)</label>
                                                <input
                                                    type="text"
                                                    value={medDosagem}
                                                    onChange={e => setMedDosagem(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-gray-800"
                                                    placeholder="500mg, 1 gota/kg..."
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Quantidade (Ex: 1 caixa)</label>
                                                <input
                                                    type="text"
                                                    value={medQuantidade}
                                                    onChange={e => setMedQuantidade(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-gray-800"
                                                    placeholder="1 caixa, 2 frascos..."
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">A cada (Horários)</label>
                                                <input
                                                    type="text"
                                                    value={medHorarios}
                                                    onChange={e => setMedHorarios(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-gray-800"
                                                    placeholder="8 em 8 horas..."
                                                />
                                            </div>
                                            <div className="col-span-1">
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Duração</label>
                                                <input
                                                    type="text"
                                                    value={medDuracao}
                                                    onChange={e => setMedDuracao(e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-gray-800"
                                                    placeholder="5 dias, Contínuo..."
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAddMedicamento}
                                            disabled={!medNome.trim()}
                                            className="w-full mt-2 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium text-sm rounded-lg transition disabled:opacity-50"
                                        >
                                            Inserir na Receita
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Assistente de Exames */}
                        {docType === "Exames" && (
                            <div className="mb-4 space-y-3">
                                {listaExames.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {listaExames.map((ex, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-100 text-cyan-800 text-xs font-medium rounded-full border border-cyan-200">
                                                {ex}
                                                <button type="button" onClick={() => handleRemoveExame(idx)} className="text-cyan-600 hover:text-red-500">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {!isAdicionandoExame ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsAdicionandoExame(true)}
                                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-cyan-300 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-medium rounded-xl transition"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Adicionar exame
                                    </button>
                                ) : (
                                    <div className="bg-cyan-50 p-4 rounded-xl border border-cyan-200">
                                        <div className="flex gap-2">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={exameInput}
                                                onChange={e => setExameInput(e.target.value)}
                                                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-cyan-500 text-sm text-gray-800"
                                                placeholder="Nome do exame..."
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddExame();
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddExame}
                                                className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 transition"
                                            >
                                                Adicionar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsAdicionandoExame(false)}
                                                className="p-2 text-gray-400 hover:text-red-500 transition"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Campo de Dias de Atestado */}
                        {docType === "Atestado" && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nº de dias de afastamento
                                </label>
                                <input
                                    type="number"
                                    value={atestadoDias}
                                    onChange={e => setAtestadoDias(e.target.value)}
                                    className="w-full max-w-[150px] px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none text-gray-800 font-semibold"
                                    placeholder="0"
                                />
                            </div>
                        )}

                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {docType === "Exames" || docType === "Atestado" ? "Conteúdo / Observações" : "Conteúdo"}
                        </label>
                        <textarea
                            className="flex-1 w-full min-h-[160px] p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none text-gray-800 text-sm"
                            placeholder={
                                docType === "Receita" ? "O texto da receita aparecerá e poderá ser editado aqui..." :
                                    docType === "Exames" ? "Exames adicionados acima. Digite observações aqui se necessário..." :
                                        docType === "Atestado" ? "Digita as observações do atestado (ex: motivo, CID)..." :
                                            "Digite aqui o conteúdo para o seu paciente..."
                            }
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            required={docType !== "Exames" && docType !== "Atestado" && !isAdicionandoMed}
                        />

                        {(docType === "Atestado") && (
                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                <FilePlus className="w-3 h-3" /> Dica: Lembre-se de incluir o CID se necessário nas observações.
                            </p>
                        )}
                        {(docType === "Encaminhamento") && (
                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                <Stethoscope className="w-3 h-3" /> Dica: Especifique a especialidade e o motivo do encaminhamento clínico.
                            </p>
                        )}
                    </form>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="document-form"
                        disabled={
                            docType === "Receita" ? (!content.trim() && !isAdicionandoMed) :
                                docType === "Exames" ? (listaExames.length === 0 && !content.trim()) :
                                    docType === "Atestado" ? (!atestadoDias.trim() && !content.trim()) :
                                        !content.trim()
                        }
                        className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-cyan-600/20"
                    >
                        <Send className="w-4 h-4" />
                        Enviar para Paciente
                    </button>
                </div>

            </div>
        </div>
    );
}
