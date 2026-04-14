"use client";

import { useState, useRef } from "react";
import { X, Pill, Send, Plus, Search, CheckSquare, Square, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

interface MedicamentoPrescricao {
    nome: string;
    dosagem: string;
    quantidade?: string;
    horarios?: string;
    duracao?: string;
}

interface Tratamento {
    condicao: string;
    medicamentos: string[]; // IDs (nomes para simplificar)
    descricao: string;
}

interface TratamentoModalProps {
    isOpen: boolean;
    onClose: () => void;
    pacienteId: string;
    profissionalId?: string;
    medicamentosDaReceita?: MedicamentoPrescricao[]; // Vem da receita emitida
}

// Lista de condições comuns para autocomplete
const CONDICOES_COMUNS = [
    "Diabetes Mellitus Tipo 2",
    "Diabetes Mellitus Tipo 1",
    "Hipertensão Arterial Sistêmica",
    "Enxaqueca",
    "Asma Brônquica",
    "Rinite Alérgica",
    "Gastrite",
    "Refluxo Gastroesofágico",
    "Ansiedade",
    "Depressão",
    "Hipotireoidismo",
    "Hipertireoidismo",
    "Colesterol Alto",
    "Insuficiência Cardíaca",
    "Fibromialgia",
    "Artrite Reumatoide",
    "Osteoporose",
    "Infecção Urinária",
    "Sinusite",
    "Bronquite",
    "Pneumonia",
    "Dermatite",
    "Psoríase",
    "Epilepsia",
    "Doença de Crohn",
    "Colite Ulcerativa",
    "Gota",
    "Lombalgia",
    "Cervicalgia",
    "Enxaqueca Crônica",
];

export default function TratamentoModal({
    isOpen,
    onClose,
    pacienteId,
    profissionalId,
    medicamentosDaReceita = []
}: TratamentoModalProps) {
    const [tratamentos, setTratamentos] = useState<Tratamento[]>([
        { condicao: "", medicamentos: [], descricao: "" }
    ]);
    const [sugestoesCondicao, setSugestoesCondicao] = useState<string[]>([]);
    const [indexAtivo, setIndexAtivo] = useState<number>(0);
    const [salvando, setSalvando] = useState(false);
    const timeoutRef = useRef<any>(null);

    if (!isOpen) return null;

    const buscarCondicao = (query: string, idx: number) => {
        const nova = [...tratamentos];
        nova[idx].condicao = query;
        setTratamentos(nova);
        setIndexAtivo(idx);

        if (query.length >= 2) {
            const filtradas = CONDICOES_COMUNS.filter(c =>
                c.toLowerCase().includes(query.toLowerCase())
            );
            setSugestoesCondicao(filtradas.slice(0, 8));
        } else {
            setSugestoesCondicao([]);
        }
    };

    const selecionarCondicao = (nome: string, idx: number) => {
        const nova = [...tratamentos];
        nova[idx].condicao = nome;
        setTratamentos(nova);
        setSugestoesCondicao([]);
    };

    const toggleMedicamento = (medNome: string, idx: number) => {
        const nova = [...tratamentos];
        const meds = nova[idx].medicamentos;
        if (meds.includes(medNome)) {
            nova[idx].medicamentos = meds.filter(m => m !== medNome);
        } else {
            nova[idx].medicamentos = [...meds, medNome];
        }
        setTratamentos(nova);
    };

    const adicionarTratamento = () => {
        setTratamentos(prev => [...prev, { condicao: "", medicamentos: [], descricao: "" }]);
        setIndexAtivo(tratamentos.length);
    };

    const removerTratamento = (idx: number) => {
        if (tratamentos.length === 1) return;
        setTratamentos(prev => prev.filter((_, i) => i !== idx));
        setIndexAtivo(Math.max(0, idx - 1));
    };

    const handleSalvar = async (e: React.FormEvent) => {
        e.preventDefault();

        const validos = tratamentos.filter(t => t.condicao.trim() && t.medicamentos.length > 0);
        if (validos.length === 0) {
            toast.error("Informe pelo menos uma condição e selecione um medicamento.");
            return;
        }

        setSalvando(true);
        try {
            // Salva cada tratamento separadamente
            const promises = validos.flatMap(t =>
                t.medicamentos.map(medNome => {
                    const medInfo = medicamentosDaReceita.find(m => m.nome === medNome);
                    return fetch("/api/paciente/tratamento", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            pacienteId,
                            profissionalId,
                            descricao: t.descricao || t.condicao,
                            medicamento: medNome,
                            dosagem: medInfo?.dosagem || "",
                            quantidade: medInfo?.quantidade || "",
                            horario: medInfo?.horarios || "",
                            duracao: medInfo?.duracao || "",
                            nomeCondicao: t.condicao,
                        }),
                    });
                })
            );

            await Promise.all(promises);
            toast.success(`${validos.length} tratamento(s) registrado(s) com sucesso!`);
            setTratamentos([{ condicao: "", medicamentos: [], descricao: "" }]);
            onClose();
        } catch {
            toast.error("Erro ao salvar tratamentos.");
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Pill className="w-5 h-5" /> Registrar Tratamentos
                        </h2>
                        <p className="text-orange-100 text-xs mt-0.5">
                            Selecione os medicamentos prescritos para cada condição
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSalvar} className="flex-1 overflow-y-auto p-5 space-y-4">

                    {/* Medicamentos Disponíveis (da receita) */}
                    {medicamentosDaReceita.length > 0 ? (
                        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 mb-4">
                            <p className="text-xs font-semibold text-cyan-700 mb-2 flex items-center gap-1.5">
                                <CheckSquare className="w-3.5 h-3.5" />
                                Medicamentos da Receita Emitida
                            </p>
                            <p className="text-xs text-cyan-600">
                                Selecione os medicamentos que fazem parte de cada tratamento abaixo.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-xs font-medium text-amber-700">
                                ⚠️ Nenhuma receita foi emitida nesta consulta. Para vincular medicamentos ao tratamento, gere uma receita primeiro.
                            </p>
                        </div>
                    )}

                    {/* Blocos de Tratamento */}
                    {tratamentos.map((t, idx) => (
                        <div key={idx} className={`border-2 ${indexAtivo === idx ? 'border-orange-400' : 'border-gray-200'} rounded-xl p-4 space-y-3 transition-all`}>

                            {/* Header do bloco */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                    Tratamento {idx + 1}
                                </span>
                                {tratamentos.length > 1 && (
                                    <button type="button" onClick={() => removerTratamento(idx)}
                                        className="text-gray-300 hover:text-red-500 transition">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Campo condição com autocomplete */}
                            <div className="relative" onClick={() => setIndexAtivo(idx)}>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">
                                    Condição / Diagnóstico *
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={t.condicao}
                                        onChange={e => buscarCondicao(e.target.value, idx)}
                                        onFocus={() => { setIndexAtivo(idx); if (t.condicao.length >= 1) buscarCondicao(t.condicao, idx); }}
                                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-orange-400 text-sm text-gray-800"
                                        placeholder="Ex: Diabetes, Hipertensão..."
                                    />
                                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                </div>

                                {indexAtivo === idx && sugestoesCondicao.length > 0 && (
                                    <div
                                        className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto"
                                        onMouseDown={e => e.preventDefault()}
                                    >
                                        {sugestoesCondicao.map((s, si) => (
                                            <button
                                                key={si}
                                                type="button"
                                                onClick={() => selecionarCondicao(s, idx)}
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 border-b border-gray-100 last:border-0 transition"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Checkboxes dos medicamentos */}
                            {medicamentosDaReceita.length > 0 && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-2">
                                        Medicamentos deste Tratamento *
                                    </label>
                                    <div className="grid grid-cols-1 gap-1.5">
                                        {medicamentosDaReceita.map((med, midx) => {
                                            const isChecked = t.medicamentos.includes(med.nome);
                                            return (
                                                <button
                                                    key={midx}
                                                    type="button"
                                                    onClick={() => toggleMedicamento(med.nome, idx)}
                                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition text-left ${isChecked
                                                            ? 'border-orange-400 bg-orange-50'
                                                            : 'border-gray-200 bg-gray-50 hover:border-orange-300'
                                                        }`}
                                                >
                                                    {isChecked
                                                        ? <CheckSquare className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                                        : <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                    }
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-semibold text-sm text-gray-800">{med.nome}</span>
                                                        {med.dosagem && (
                                                            <span className="text-xs text-gray-500 ml-2">({med.dosagem})</span>
                                                        )}
                                                        {med.quantidade && (
                                                            <span className="text-xs text-gray-400 ml-1">— Qtd: {med.quantidade}</span>
                                                        )}
                                                    </div>
                                                    {med.duracao && (
                                                        <span className="text-xs text-gray-400 flex-shrink-0">{med.duracao}</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Observações opcionais */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">
                                    Observações (opcional)
                                </label>
                                <textarea
                                    value={t.descricao}
                                    onChange={e => { const n = [...tratamentos]; n[idx].descricao = e.target.value; setTratamentos(n); }}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-800 focus:ring-2 focus:ring-orange-400 outline-none resize-none"
                                    placeholder="Ex: Paciente com dificuldade de adesão ao tratamento..."
                                />
                            </div>
                        </div>
                    ))}

                    {/* Botão Novo Tratamento */}
                    <button
                        type="button"
                        onClick={adicionarTratamento}
                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-600 font-medium rounded-xl transition text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Adicionar outro tratamento
                    </button>

                    {/* Ações */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="px-5 py-2.5 rounded-xl font-medium text-gray-700 hover:bg-gray-200 transition">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={salvando}
                            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition flex items-center gap-2 disabled:opacity-50 shadow-md"
                        >
                            <Send className="w-4 h-4" /> {salvando ? "Salvando..." : "Registrar Tratamentos"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
