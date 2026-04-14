"use client";

import { useState, useEffect } from "react";
import { 
    X, Check, Save, FileText, ClipboardList, Pill, 
    Stethoscope, Loader2, Edit3, MessageSquare, 
    User, AlertCircle, Heart, Plus, Trash2, ArrowRight, Zap, Sidebar
} from "lucide-react";
import { toast } from "react-hot-toast";
import { generatePdfBlob } from "@/utils/generatePdfTeleconsulta";

interface AIReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    pacienteId: string;
    aiResult: {
        transcricao: string;
        analise: {
            relato: string;
            sintomas: { nome: string; intensidade?: string; info?: string }[];
            receitas: { medicamento: string; dosagem: string; orientacoes: string }[];
            exames: string[];
            encaminhamentos: string[];
            condicoes?: { nome: string; cid: string }[];
            tratamentos_atuais?: string[];
        };
        tempoTranscricao?: number;
    } | null;
}

type TabType = "resumo" | "sintomas" | "diagnosticos" | "documentos" | "transcricao";

export default function AIReviewModal({ isOpen, onClose, pacienteId, aiResult }: AIReviewModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>("resumo");
    
    // Estados editáveis
    const [relato, setRelato] = useState("");
    const [sintomas, setSintomas] = useState<any[]>([]);
    const [receitas, setReceitas] = useState<any[]>([]);
    const [exames, setExames] = useState<string[]>([]);
    const [encaminhamentos, setEncaminhamentos] = useState<string[]>([]);
    const [condicoes, setCondicoes] = useState<any[]>([]);
    const [tratamentosAtuais, setTratamentosAtuais] = useState<string[]>([]);
    
    // Histórico do Paciente
    const [patientHistory, setPatientHistory] = useState<any>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (aiResult) {
            setRelato(aiResult.analise.relato || "");
            setSintomas(aiResult.analise.sintomas || []);
            setReceitas(aiResult.analise.receitas || []);
            setExames(aiResult.analise.exames || []);
            setEncaminhamentos(aiResult.analise.encaminhamentos || []);
            setCondicoes(aiResult.analise.condicoes || []);
            setTratamentosAtuais(aiResult.analise.tratamentos_atuais || []);
        }

        const fetchHistory = async () => {
            setIsLoadingHistory(true);
            try {
                const res = await fetch(`/api/paciente/resumo?pacienteId=${pacienteId}`);
                const data = await res.json();
                setPatientHistory(data);
            } catch (err) {
                console.error("Erro ao buscar histórico:", err);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        if (isOpen && pacienteId) {
            fetchHistory();
        }
    }, [aiResult, isOpen, pacienteId]);

    if (!isOpen || !aiResult) return null;

    const handleSaveEverything = async () => {
        setIsSaving(true);
        try {
            const relatoRes = await fetch("/api/relato", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    paciente_id: pacienteId,
                    descricao: relato,
                    sintomas: sintomas.map(s => ({
                        nome: s.nome,
                        intensidade: s.intensidade || "",
                        informacoes_adicionais: s.info || ""
                    })),
                    tipo: "voz",
                    tempo_transcricao: aiResult.tempoTranscricao || 0
                })
            });

            if (!relatoRes.ok) throw new Error("Falha ao salvar relato clínico");

            const medicoName = "Dr. Logado"; 
            const patientData = await fetch(`/api/paciente/resumo?pacienteId=${pacienteId}`).then(r => r.json());

            if (receitas.length > 0) {
                const content = receitas.map(r => `- ${r.medicamento} (${r.dosagem})\n  Uso: ${r.orientacoes}`).join("\n\n");
                const blob = await generatePdfBlob("Receita", content, medicoName, patientData);
                await uploadDocument(blob, "Receita");
            }

            if (exames.length > 0) {
                const content = "Solicito os seguintes exames:\n" + exames.map(e => `- ${typeof e === 'string' ? e : (e as any).nome}`).join("\n");
                const blob = await generatePdfBlob("Exames", content, medicoName, patientData);
                await uploadDocument(blob, "Exames");
            }

            if (encaminhamentos.length > 0) {
                const content = "Encaminhamento solicitado para:\n" + encaminhamentos.map(e => `- ${typeof e === 'string' ? e : (e as any).nome}`).join("\n");
                const blob = await generatePdfBlob("Encaminhamento", content, medicoName, patientData);
                await uploadDocument(blob, "Encaminhamento");
            }

            for (const cond of condicoes) {
                await fetch("/api/paciente/condicao", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        pacienteId, 
                        descricao: `${cond.nome} (CID: ${cond.cid})`,
                        desdeQuando: "Identificado em teleconsulta"
                    }),
                });
            }

            for (const trat of tratamentosAtuais) {
                await fetch("/api/paciente/tratamento", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        pacienteId, 
                        medicamento: trat,
                        descricao: "Tratamento relatado em teleconsulta"
                    }),
                });
            }

            toast.success("Consulta registrada com sucesso!");
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error("Erro ao registrar: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const uploadDocument = async (blob: Blob, tipo: string) => {
        const formData = new FormData();
        formData.append("file", blob, `${tipo.toLowerCase()}.pdf`);
        formData.append("tipo", tipo);
        formData.append("user_id", pacienteId);
        await fetch("/api/documentos", { method: "POST", body: formData });
    };

    const TabButton = ({ id, icon: Icon, label }: { id: TabType, icon: any, label: string }) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-4 transition-all relative whitespace-nowrap ${activeTab === id ? 'text-cyan-600 font-bold' : 'text-gray-400 hover:text-gray-600'}`}
        >
            <Icon className="w-4 h-4" />
            <span className="text-sm">{label}</span>
            {activeTab === id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-600 rounded-t-full shadow-[0_-2px_8px_rgba(8,145,178,0.4)]" />
            )}
        </button>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] flex flex-col rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] overflow-hidden">
                
                {/* Header Section */}
                <header className="px-8 py-6 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-600/20">
                            <Zap className="w-5 h-5 text-white fill-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 leading-none">Revisão Clínica</h2>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mt-1">IA do Cliv • {patientHistory?.nome || "Carregando..."}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-xl shadow-sm border border-gray-100">
                        <X className="w-5 h-5" />
                    </button>
                </header>

                {/* Patient Summary Bar (Info Strip) */}
                <div className="px-8 py-4 bg-cyan-50/30 border-b border-cyan-100/20 flex flex-wrap gap-8 items-center">
                    <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-cyan-600" />
                        <span className="text-[11px] font-bold text-gray-600">{patientHistory?.nome || "..."}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-[11px] font-bold text-gray-600">Sintomas Prontuário: </span>
                        <div className="flex gap-1">
                            {patientHistory?.sintomas_recentes?.map((s: string, i: number) => (
                                <span key={i} className="px-1.5 py-0.5 bg-white border border-cyan-100 rounded text-[9px] text-cyan-700 font-bold">{s}</span>
                            )) || <span className="text-[9px] text-gray-400 italic">Nenhum</span>}
                        </div>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <nav className="px-4 border-b border-gray-100 bg-white flex overflow-x-auto no-scrollbar">
                    <TabButton id="resumo" icon={Edit3} label="Anamnese" />
                    <TabButton id="sintomas" icon={Stethoscope} label="Sintomas" />
                    <TabButton id="diagnosticos" icon={Heart} label="Diagnósticos" />
                    <TabButton id="documentos" icon={FileText} label="Documentos" />
                    <TabButton id="transcricao" icon={MessageSquare} label="Transcrição Whisper" />
                </nav>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto p-8 bg-gray-50/30 no-scrollbar">
                    <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
                        
                        {activeTab === "resumo" && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-[24px] border border-gray-100 p-8 shadow-sm">
                                    <label className="text-[10px] font-black text-cyan-600 uppercase tracking-widest mb-4 block flex items-center gap-2">
                                        <Sidebar className="w-3.5 h-3.5" /> Descrição Clínica do Caso
                                    </label>
                                    <textarea 
                                        value={relato}
                                        onChange={(e) => setRelato(e.target.value)}
                                        className="w-full min-h-[350px] bg-transparent text-gray-700 text-base leading-relaxed outline-none border-none placeholder:text-gray-300 resize-none"
                                        placeholder="Digite ou revise o relato clínico aqui..."
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === "sintomas" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {sintomas.map((s, idx) => (
                                    <div key={idx} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:border-cyan-200 transition-all group">
                                        <div className="flex justify-between items-start mb-2">
                                            <input 
                                                className="font-bold text-gray-800 bg-transparent outline-none w-full text-sm"
                                                value={s.nome}
                                                onChange={(e) => {
                                                    const n = [...sintomas]; n[idx].nome = e.target.value; setSintomas(n);
                                                }}
                                            />
                                            <button onClick={() => setSintomas(sintomas.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <input 
                                            className="text-[10px] font-bold uppercase tracking-wider bg-gray-50 text-cyan-600 px-2.5 py-1.5 rounded-lg border border-gray-100 outline-none w-fit"
                                            value={s.intensidade || ""}
                                            placeholder="INTENSIDADE"
                                            onChange={(e) => {
                                                const n = [...sintomas]; n[idx].intensidade = e.target.value; setSintomas(n);
                                            }}
                                        />
                                    </div>
                                ))}
                                <button 
                                    onClick={() => setSintomas([...sintomas, { nome: "Novo Sintoma", intensidade: "" }])}
                                    className="border-2 border-dashed border-gray-200 bg-white/50 hover:bg-white rounded-2xl p-6 text-gray-400 hover:text-cyan-600 transition-all flex items-center justify-center gap-2 group"
                                >
                                    <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" /> 
                                    <span className="font-bold text-xs uppercase tracking-widest">Adicionar Sintoma</span>
                                </button>
                            </div>
                        )}

                        {activeTab === "diagnosticos" && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 gap-4">
                                    {condicoes.map((c, idx) => (
                                        <div key={idx} className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm flex items-center gap-4 group hover:border-rose-200 transition-all">
                                            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                                                <Heart className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1">
                                                <input 
                                                    className="font-bold text-gray-800 bg-transparent outline-none w-full text-base mb-0.5"
                                                    value={c.nome}
                                                    onChange={(e) => {
                                                        const n = [...condicoes]; n[idx].nome = e.target.value; setCondicoes(n);
                                                    }}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none">CID-10:</span>
                                                    <input 
                                                        className="text-xs font-bold text-gray-500 bg-transparent outline-none border-b border-transparent hover:border-rose-100 focus:border-rose-300 transition-all h-4"
                                                        value={c.cid}
                                                        onChange={(e) => {
                                                            const n = [...condicoes]; n[idx].cid = e.target.value; setCondicoes(n);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <button onClick={() => setCondicoes(condicoes.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => setCondicoes([...condicoes, { nome: "Novo Diagnóstico", cid: "" }])}
                                    className="w-full border-2 border-dashed border-gray-200 bg-white/50 hover:bg-white rounded-2xl py-5 font-black text-xs uppercase tracking-[0.2em] text-gray-400 hover:text-rose-500 transition-all"
                                >
                                    + Registrar Nova Condição / CID
                                </button>
                            </div>
                        )}

                        {activeTab === "documentos" && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
                                    <div className="flex items-center gap-2 mb-6 border-b border-gray-50 pb-4">
                                        <Pill className="w-5 h-5 text-amber-500" />
                                        <h4 className="text-lg font-black text-gray-800 tracking-tight">Prescrições Atuais</h4>
                                    </div>
                                    <div className="space-y-4">
                                        {receitas.map((r, idx) => (
                                            <div key={idx} className="bg-gray-50/50 border border-gray-100 p-6 rounded-2xl group hover:border-amber-200 transition-all relative">
                                                <button onClick={() => setReceitas(receitas.filter((_, i) => i !== idx))} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                    <X className="w-4 h-4" />
                                                </button>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Medicamento</label>
                                                        <input 
                                                            className="font-bold text-gray-800 bg-white border border-gray-100 rounded-lg px-3 py-2 w-full outline-none focus:ring-2 focus:ring-amber-500/20"
                                                            value={r.medicamento}
                                                            onChange={(e) => {
                                                                const n = [...receitas]; n[idx].medicamento = e.target.value; setReceitas(n);
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Dosagem</label>
                                                        <input 
                                                            className="font-bold text-amber-600 bg-amber-50/50 border border-amber-100 rounded-lg px-3 py-2 w-full outline-none focus:ring-2 focus:ring-amber-500/20"
                                                            value={r.dosagem}
                                                            onChange={(e) => {
                                                                const n = [...receitas]; n[idx].dosagem = e.target.value; setReceitas(n);
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Orientações</label>
                                                <textarea 
                                                    className="w-full bg-white p-3 rounded-lg text-sm text-gray-600 border border-gray-100 outline-none focus:ring-2 focus:ring-amber-500/20 min-h-[60px] resize-none"
                                                    value={r.orientacoes}
                                                    onChange={(e) => {
                                                        const n = [...receitas]; n[idx].orientacoes = e.target.value; setReceitas(n);
                                                    }}
                                                />
                                            </div>
                                        ))}
                                        <button 
                                            onClick={() => setReceitas([...receitas, { medicamento: "", dosagem: "", orientacoes: "" }])}
                                            className="w-full py-4 border-2 border-dashed border-gray-100 rounded-2xl text-[11px] font-bold text-gray-400 hover:text-amber-500 hover:bg-amber-50/30 transition-all uppercase tracking-widest"
                                        >
                                            + Nova Prescrição
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                                        <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Edit3 className="w-3 h-3" /> Exames Sugeridos
                                        </h5>
                                        <div className="space-y-3">
                                            {exames.map((ex, idx) => (
                                                <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 group transition-all">
                                                    <input 
                                                        className="flex-1 bg-transparent text-xs font-bold text-gray-700 outline-none"
                                                        value={typeof ex === 'string' ? ex : (ex as any).nome}
                                                        onChange={(e) => {
                                                            const n = [...exames]; n[idx] = e.target.value; setExames(n);
                                                        }}
                                                    />
                                                    <button onClick={() => setExames(exames.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button onClick={() => setExames([...exames, "Novo Exame"])} className="text-[10px] font-bold text-cyan-600 hover:underline uppercase tracking-widest">+ Adicionar</button>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                                        <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <User className="w-3 h-3" /> Encaminhamentos
                                        </h5>
                                        <div className="space-y-3">
                                            {encaminhamentos.map((en, idx) => (
                                                <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 group transition-all">
                                                    <input 
                                                        className="flex-1 bg-transparent text-xs font-bold text-gray-700 outline-none"
                                                        value={typeof en === 'string' ? en : (en as any).nome}
                                                        onChange={(e) => {
                                                            const n = [...encaminhamentos]; n[idx] = e.target.value; setEncaminhamentos(n);
                                                        }}
                                                    />
                                                    <button onClick={() => setEncaminhamentos(encaminhamentos.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button onClick={() => setEncaminhamentos([...encaminhamentos, "Especialidade"])} className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-widest">+ Adicionar</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "transcricao" && (
                            <div className="bg-white rounded-[32px] border border-gray-100 p-10 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 to-indigo-500 opacity-20" />
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                        <MessageSquare className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-gray-800 tracking-tight">Transcrição de Alta Precisão</h4>
                                        <p className="text-[9px] text-gray-400 uppercase font-black tracking-[0.2em]">Processamento via OpenAI Whisper</p>
                                    </div>
                                </div>
                                <div className="text-gray-600 text-base leading-relaxed whitespace-pre-wrap font-medium bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                                    {aiResult.transcricao}
                                </div>
                            </div>
                        )}

                    </div>
                </main>

                {/* Footer Section */}
                <footer className="px-8 py-6 bg-white border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                        <Zap className="w-3.5 h-3.5 text-cyan-600" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Documentação Protegida</span>
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={onClose}
                            className="px-6 py-3 font-bold text-xs text-gray-400 hover:text-gray-600 uppercase tracking-widest"
                        >
                            Descartar
                        </button>
                        <button 
                            onClick={handleSaveEverything}
                            disabled={isSaving}
                            className="px-10 py-3.5 bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs uppercase tracking-[0.15em] rounded-2xl transition-all flex items-center gap-3 shadow-lg shadow-cyan-600/20 active:scale-[0.98] disabled:opacity-50"
                        >
                            {isSaving ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                            ) : (
                                <><Check className="w-4 h-4" /> Finalizar Consulta</>
                            )}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
