"use client";

import { useState } from "react";
import { X, Heart, Send } from "lucide-react";
import toast from "react-hot-toast";

interface CondicaoModalProps {
    isOpen: boolean;
    onClose: () => void;
    pacienteId: string;
}

export default function CondicaoModal({ isOpen, onClose, pacienteId }: CondicaoModalProps) {
    const [descricao, setDescricao] = useState("");
    const [desdeQuando, setDesdeQuando] = useState("");
    const [salvando, setSalvando] = useState(false);

    if (!isOpen) return null;

    const handleSalvar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!descricao.trim()) return;
        setSalvando(true);
        try {
            const res = await fetch("/api/paciente/condicao", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pacienteId, descricao, desdeQuando }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Condição registrada com sucesso!");
                setDescricao(""); setDesdeQuando("");
                onClose();
            } else {
                toast.error(data.error || "Erro ao salvar condição.");
            }
        } catch {
            toast.error("Erro de conexão.");
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
                <div className="bg-rose-50 border-b border-rose-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <h2 className="text-lg font-bold text-rose-800 flex items-center gap-2">
                        <Heart className="w-5 h-5" /> Registrar
                    </h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSalvar} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Condição / Comorbidade</label>
                        <textarea
                            value={descricao}
                            onChange={e => setDescricao(e.target.value)}
                            rows={3}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-800 focus:ring-2 focus:ring-rose-400 outline-none resize-none"
                            placeholder="Ex: Hipertensão arterial sistêmica, Diabetes tipo 2, Asma..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Desde quando (opcional)</label>
                        <input type="text" value={desdeQuando} onChange={e => setDesdeQuando(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-800 focus:ring-2 focus:ring-rose-400 outline-none"
                            placeholder="Ex: 2015, há 5 anos, desde a infância..." />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="px-5 py-2.5 rounded-xl font-medium text-gray-700 hover:bg-gray-200 transition">
                            Cancelar
                        </button>
                        <button type="submit" disabled={salvando || !descricao.trim()}
                            className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-medium transition flex items-center gap-2 disabled:opacity-50">
                            <Send className="w-4 h-4" /> {salvando ? "Salvando..." : "Registrar"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
