"use client";

import { useEffect, useState } from "react";
import { X, User, Activity, FileText, ClipboardList, AlertCircle, Loader2, Calendar, Mic, PenLine, Heart, Pill } from "lucide-react";

interface HistoricoItem {
    id: string;
    descricao: string;
    tipo: string;
    data_cadastro: string;
    classificacao: string;
    sintomas: string[];
}

interface Condicao {
    id: string;
    descricao: string;
    desde_quando?: string;
    data_cadastro: string;
}

interface Tratamento {
    id: string;
    descricao?: string;
    medicamento?: string;
    dosagem?: string;
    duracao?: string;
    horario?: string;
    data_cadastro: string;
}

interface ResumoPaciente {
    nome: string;
    email: string | null;
    idade: number | null;
    classificacao_risco: string;
    sintomas_recentes: string[];
    historicos: HistoricoItem[];
    exames_anexados: string[];
    condicoes_cronicas: Condicao[];
    tratamentos_ativos: Tratamento[];
}

interface ProntuarioModalProps {
    isOpen: boolean;
    onClose: () => void;
    pacienteId: string;
}

function ClassBadge({ classificacao }: { classificacao: string }) {
    const c = classificacao?.toLowerCase() || "";
    const cls =
        c.includes("vermelho") || c.includes("emergência") ? "bg-red-100 text-red-700" :
            c.includes("laranja") || c.includes("urgente") ? "bg-orange-100 text-orange-700" :
                c.includes("amarelo") ? "bg-yellow-100 text-yellow-700" :
                    c.includes("verde") ? "bg-green-100 text-green-700" :
                        c.includes("azul") ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-600";
    return (
        <span className={`inline-flex px-2.5 py-0.5 rounded-md text-xs font-bold uppercase ${cls}`}>
            {classificacao || "—"}
        </span>
    );
}

const Section = ({ icon: Icon, title, color, children }: { icon: any; title: string; color: string; children: React.ReactNode }) => (
    <div>
        <h3 className={`text-sm font-bold uppercase tracking-wider ${color} mb-3 flex items-center gap-2`}>
            <Icon className="w-4 h-4" /> {title}
        </h3>
        {children}
    </div>
);

export default function ProntuarioModal({ isOpen, onClose, pacienteId }: ProntuarioModalProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ResumoPaciente | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !pacienteId) return;
        setLoading(true);
        setError(null);
        fetch(`/api/paciente/resumo?pacienteId=${encodeURIComponent(pacienteId)}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.error) setError(resData.error);
                else setData(resData);
                setLoading(false);
            })
            .catch(() => {
                setError("Erro de conexão ao servidor.");
                setLoading(false);
            });
    }, [isOpen, pacienteId]);

    if (!isOpen) return null;

    const fmt = (iso: string) =>
        new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[60vh] flex flex-col overflow-hidden">

                <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-600" /> Prontuário
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                            <p className="text-gray-500">Recuperando histórico do paciente...</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
                            <p className="text-gray-700 font-medium">Não foi possível carregar os dados</p>
                            <p className="text-sm text-gray-500 mt-1">{error}</p>
                        </div>
                    )}

                    {!loading && !error && data && (
                        <>
                            {/* Info básica */}
                            <div className="flex flex-wrap gap-4 items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <div className="flex-1 min-w-[180px]">
                                    <p className="text-xs text-gray-500 mb-0.5">Paciente</p>
                                    <p className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                        <User className="w-4 h-4 text-blue-600" /> {data.nome}
                                    </p>
                                    {data.email && <p className="text-xs text-gray-500 mt-0.5">{data.email}</p>}
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-0.5">Idade</p>
                                    <p className="font-semibold text-gray-800">{data.idade ? `${data.idade} anos` : "Não inf."}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-0.5">Última Triagem</p>
                                    <ClassBadge classificacao={data.classificacao_risco} />
                                </div>
                            </div>

                            {/* Sintomas */}
                            <Section icon={Activity} title="Queixas e Sintomas" color="text-gray-500">
                                {data.sintomas_recentes.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {data.sintomas_recentes.map((s, i) => (
                                            <span key={i} className="bg-gray-100 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium">{s}</span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-400 text-sm italic">Nenhum sintoma registrado nas triagens.</p>
                                )}
                            </Section>

                            {/* Condições */}
                            <Section icon={Heart} title="Condições / Comorbidades" color="text-rose-500">
                                {data.condicoes_cronicas.length > 0 ? (
                                    <ul className="space-y-2">
                                        {data.condicoes_cronicas.map((c) => (
                                            <li key={c.id} className="bg-rose-50 border border-rose-100 rounded-lg px-4 py-2 text-sm text-gray-800 flex justify-between gap-2">
                                                <span>{c.descricao}</span>
                                                {c.desde_quando && <span className="text-xs text-gray-400 whitespace-nowrap">desde {c.desde_quando}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-400 text-sm italic">Nenhuma condição registrada.</p>
                                )}
                            </Section>

                            {/* Tratamentos */}
                            <Section icon={Pill} title="Tratamentos" color="text-orange-500">
                                {data.tratamentos_ativos.length > 0 ? (
                                    <ul className="space-y-2">
                                        {data.tratamentos_ativos.map((t) => (
                                            <li key={t.id} className="bg-orange-50 border border-orange-100 rounded-lg px-4 py-2 text-sm text-gray-800">
                                                {t.medicamento && <p className="font-semibold">{t.medicamento}{t.dosagem ? ` — ${t.dosagem}` : ""}</p>}
                                                {t.descricao && <p className="text-gray-600 mt-0.5">{t.descricao}</p>}
                                                {(t.horario || t.duracao) && (
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {t.horario && `${t.horario}`}{t.horario && t.duracao && " · "}{t.duracao && `${t.duracao}`}
                                                    </p>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-400 text-sm italic">Nenhum tratamento registrado.</p>
                                )}
                            </Section>

                            {/* Exames */}
                            <Section icon={FileText} title="Exames" color="text-gray-500">
                                <p className="text-gray-400 text-sm italic">Nenhum exame anexado.</p>
                            </Section>

                            {/* Histórico de triagens */}
                            <Section icon={FileText} title={`Histórico de Triagens (${data.historicos.length})`} color="text-gray-500">
                                {data.historicos.length === 0 ? (
                                    <p className="text-gray-400 text-sm italic">Nenhuma triagem registrada.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {data.historicos.map((h) => (
                                            <div key={h.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        {h.tipo === "voz" ? <Mic className="w-3.5 h-3.5" /> : <PenLine className="w-3.5 h-3.5" />}
                                                        <span className="capitalize">{h.tipo || "triagem"}</span>
                                                        <span>·</span>
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        <span>{fmt(h.data_cadastro)}</span>
                                                    </div>
                                                    <ClassBadge classificacao={h.classificacao} />
                                                </div>
                                                {h.descricao && <p className="text-sm text-gray-700 italic mb-2">"{h.descricao}"</p>}
                                                {h.sintomas?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                                        {h.sintomas.map((s, i) => (
                                                            <span key={i} className="text-xs bg-white border border-gray-300 text-gray-600 px-2 py-0.5 rounded-md">{s}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Section>
                        </>
                    )}
                </div>

                <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end flex-shrink-0">
                    <button onClick={onClose} className="px-6 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-medium transition-colors">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}
