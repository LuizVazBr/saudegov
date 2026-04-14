"use client";

import { X, FileText, MessageSquare, ClipboardList, Pill, Heart, Sparkles, Loader2, StopCircle } from "lucide-react";
import { useTheme } from "./ThemeProvider";

interface AcoesConsultaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenProntuario: () => void;
    onOpenDocumentos: () => void;
    onOpenChat: () => void;
    onOpenTratamento?: () => void;
    onOpenCondicao?: () => void;
    isRecording?: boolean;
    isProcessingAI?: boolean;
    onToggleRecording?: () => void;
}

export default function AcoesConsultaModal({
    isOpen,
    onClose,
    onOpenProntuario,
    onOpenDocumentos,
    onOpenChat,
    onOpenTratamento,
    onOpenCondicao,
    isRecording,
    isProcessingAI,
    onToggleRecording
}: AcoesConsultaModalProps) {
    const { tema } = useTheme();
    if (!isOpen) return null;

    const actions = [
        {
            label: "Prontuário",
            desc: "Ver sintomas, histórico e queixas",
            icon: ClipboardList,
            color: "blue",
            onClick: () => { onClose(); onOpenProntuario(); },
        },
        {
            label: "Emitir Documento",
            desc: "Receitas, Atestados, Exames e Guias",
            icon: FileText,
            color: "emerald",
            onClick: () => { onClose(); onOpenDocumentos(); },
        },
        {
            label: "Registrar Tratamento",
            desc: "Prescrev um tratamento para o paciente",
            icon: Pill,
            color: "orange",
            onClick: () => { onClose(); onOpenTratamento?.(); },
        },
        {
            label: "Registrar Condição",
            desc: "Comorbidades, doenças crônicas etc.",
            icon: Heart,
            color: "rose",
            onClick: () => { onClose(); onOpenCondicao?.(); },
        },
        {
            label: "Linha do Tempo",
            desc: "Ver transcrição e histórico da consulta",
            icon: MessageSquare,
            color: "purple",
            onClick: () => { onClose(); onOpenChat(); },
        },
        {
            label: isRecording ? "Parar Transcrição" : "Transcrição",
            desc: isProcessingAI ? "Processando relatório..." : (isRecording ? "Finalizar e gerar relato automático" : "Gravar áudio e gerar informações"),
            icon: isProcessingAI ? Loader2 : (isRecording ? StopCircle : Sparkles),
            color: isRecording ? "red" : "cyan",
            disabled: isProcessingAI,
            onClick: () => { if (onToggleRecording) onToggleRecording(); },
        },
    ];

    const colorMap: Record<string, string> = {
        blue: "bg-blue-100 text-blue-600 group-hover:bg-blue-200",
        emerald: "bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200",
        orange: "bg-orange-100 text-orange-600 group-hover:bg-orange-200",
        rose: "bg-rose-100 text-rose-600 group-hover:bg-rose-200",
        purple: "bg-purple-100 text-purple-600 group-hover:bg-purple-200",
        cyan: "bg-cyan-100 text-cyan-600 group-hover:bg-cyan-200",
        red: "bg-red-100 text-red-600 group-hover:bg-red-200 animate-pulse",
    };
    const textMap: Record<string, string> = {
        blue: "group-hover:text-blue-700",
        emerald: "group-hover:text-emerald-700",
        orange: "group-hover:text-orange-700",
        rose: "group-hover:text-rose-700",
        purple: "group-hover:text-purple-700",
        cyan: "group-hover:text-cyan-700",
        red: "group-hover:text-red-700 font-bold",
    };
    const hoverMap: Record<string, string> = {
        blue: "hover:bg-blue-50",
        emerald: "hover:bg-emerald-50",
        orange: "hover:bg-orange-50",
        rose: "hover:bg-rose-50",
        purple: "hover:bg-purple-50",
        cyan: "hover:bg-cyan-50",
        red: "hover:bg-red-50",
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">

                <div className="bg-gray-50 border-b border-gray-200 px-5 py-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-800">Ações</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-2 space-y-1">
                    {actions.map((a) => {
                        const Icon = a.icon;
                        return (
                            <button
                                key={a.label}
                                onClick={a.onClick}
                                disabled={(a as any).disabled}
                                className={`w-full flex items-center gap-3 p-4 ${hoverMap[a.color]} text-left rounded-xl transition group ${(a as any).disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                <div className={`p-3 rounded-xl transition ${colorMap[a.color]}`}>
                                    <Icon className={`w-6 h-6 ${(a as any).disabled && a.icon === Loader2 ? "animate-spin" : ""}`} />
                                </div>
                                <div>
                                    <p className={`font-semibold text-gray-800 ${textMap[a.color]}`}>{a.label}</p>
                                    <p className="text-xs text-gray-500">{a.desc}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
