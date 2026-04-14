"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Copy, Video, Calendar, Clock, Trash2, Edit3, X, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import HeaderIn from "@/components/HeaderIn";
import toast, { Toaster } from "react-hot-toast";
import type { Session } from "next-auth";
import { motion, AnimatePresence } from "framer-motion";
import { SimpleCalendar, Day } from "@/components/SimpleCalendar";

interface Agendamento {
    id: string;
    data_hora: string;
    status: string;
    link_sala: string;
    medico_nome: string;
    medico_id: string;
}

interface Slot {
    slot_id: string;
    data_hora: string;
    medico_nome: string;
    medico_id: string;
}

interface ClientAgendamentosProps {
    sessionServer: Session;
}

export default function ClientAgendamentos({ sessionServer }: ClientAgendamentosProps) {
    const { data: session } = useSession();
    const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { tema, themeName } = useTheme();
    const isDark = themeName === "dark";

    // Cancelamento
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Reagendamento
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingMedicoId, setEditingMedicoId] = useState<string | null>(null);
    const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
    const [selectedDay, setSelectedDay] = useState<Day | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editSuccess, setEditSuccess] = useState(false);

    useEffect(() => {
        if (session?.user?.id) {
            fetchAgendamentos();
        }
    }, [session]);

    const fetchAgendamentos = async () => {
        try {
            const res = await fetch(`/api/meus-agendamentos?usuarioId=${session?.user?.id}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setAgendamentos(data);
            }
        } catch (error) {
            console.error("Erro ao buscar agendamentos", error);
        } finally {
            setLoading(false);
        }
    };

    const copyLink = (link: string) => {
        navigator.clipboard.writeText(`https://cliv.app${link}`);
        toast.success("Link copiado!");
    };

    const handleCancelar = async (id: string) => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/meus-agendamentos?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Agendamento cancelado com sucesso.");
                setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: "cancelado" } : a));
            } else {
                toast.error("Erro ao cancelar agendamento.");
            }
        } catch {
            toast.error("Erro de conexão.");
        } finally {
            setDeleting(false);
            setConfirmDelete(null);
        }
    };

    const openEditar = async (ag: Agendamento) => {
        setEditingId(ag.id);
        setEditingMedicoId(ag.medico_id);
        setSelectedSlot(null);
        setEditSuccess(false);
        setLoadingSlots(true);

        // Auto-select today
        const today = new Date();
        setSelectedDay({ year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() });

        try {
            const res = await fetch("/api/agendamentos/disponibilidade");
            const data = await res.json();
            if (Array.isArray(data)) {
                // Filter to same doctor
                setAvailableSlots(data.filter((s: Slot) => s.medico_id === ag.medico_id));
            }
        } catch {
            toast.error("Erro ao carregar horários disponíveis.");
        } finally {
            setLoadingSlots(false);
        }
    };

    const getSlotsForDay = () => {
        if (!selectedDay) return [];
        return availableSlots.filter(slot => {
            const d = new Date(slot.data_hora);
            return d.getDate() === selectedDay.day &&
                d.getMonth() + 1 === selectedDay.month &&
                d.getFullYear() === selectedDay.year;
        });
    };

    const handleSalvarHorario = async () => {
        if (!selectedSlot || !editingId) return;
        setSaving(true);
        try {
            const res = await fetch("/api/meus-agendamentos", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: editingId, novaDataHora: selectedSlot.data_hora })
            });
            if (res.ok) {
                setEditSuccess(true);
                setAgendamentos(prev => prev.map(a => a.id === editingId ? { ...a, data_hora: selectedSlot.data_hora } : a));
            } else {
                toast.error("Erro ao reagendar consulta.");
            }
        } catch {
            toast.error("Erro de conexão.");
        } finally {
            setSaving(false);
        }
    };

    const daySlots = getSlotsForDay();

    return (
        <div className={`min-h-screen ${tema.mainBg}`}>
            <Toaster position="top-right" />
            <HeaderIn paginaAtiva="agendamentos" tipoU="" sessionServer={sessionServer} />
            <div className="px-5 py-6 max-w-2xl mx-auto pb-24">
                <h1 className={`text-2xl font-semibold ${tema.textPrimary} mb-1`}>Meus Agendamentos</h1>
                <p className={`text-sm ${tema.textSecondary} mb-6`}>
                    Suas consultas de telemedicina. Acesse, edite ou cancele seus agendamentos.
                </p>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#009AA0]"></div>
                    </div>
                ) : agendamentos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-60">
                        <Calendar className="w-16 h-16 mb-4 text-gray-400" />
                        <p className={`text-lg ${tema.textSecondary}`}>Você não tem consultas agendadas.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {agendamentos.map((item) => {
                            const date = new Date(item.data_hora);
                            const now = new Date();
                            const isToday = now.toDateString() === date.toDateString();
                            const isCancelado = item.status === "cancelado";
                            const isPast = date < now && !isCancelado;
                            const isAtivo = item.status === "agendado" && !isPast;

                            return (
                                <motion.div
                                    key={item.id}
                                    layout
                                    className={`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden transition-opacity ${isCancelado || isPast ? "opacity-60" : ""}`}
                                >
                                    {isToday && isAtivo && (
                                        <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                                            HOJE
                                        </div>
                                    )}

                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className={`font-bold text-lg ${tema.textPrimary}`}>{item.medico_nome || "Médico Clínico"}</h3>
                                            <p className={`text-sm ${tema.textSecondary}`}>Telemedicina</p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isCancelado ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                                                isPast ? "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400" :
                                                    "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                            }`}>
                                            {isCancelado ? "Cancelado" : isPast ? "Expirado" : item.status}
                                        </div>
                                    </div>

                                    <div className="flex gap-4 mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                                                <Calendar size={20} />
                                            </div>
                                            <div>
                                                <p className="text-xs opacity-60">Data</p>
                                                <p className="font-semibold text-sm">{date.toLocaleDateString("pt-BR")}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-500">
                                                <Clock size={20} />
                                            </div>
                                            <div>
                                                <p className="text-xs opacity-60">Horário</p>
                                                <p className="font-semibold text-sm">{date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expired notice */}
                                    {isPast && (
                                        <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-xl mb-3">
                                            <Clock size={16} className="text-gray-400 shrink-0" />
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                O horário desta consulta já passou. Não é mais possível entrar na sala.
                                            </p>
                                        </div>
                                    )}

                                    {/* Action buttons — only for active (not past, not cancelled) */}
                                    {isAtivo && (
                                        <div className="flex gap-2 flex-wrap">
                                            <button
                                                onClick={() => router.push(item.link_sala)}
                                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#009AA0] hover:bg-[#00888d] text-white font-bold rounded-xl transition-all active:scale-95"
                                            >
                                                <Video size={18} /> Entrar na Sala
                                            </button>
                                            <button
                                                onClick={() => copyLink(item.link_sala)}
                                                className="p-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                title="Copiar link"
                                            >
                                                <Copy size={18} />
                                            </button>
                                            <button
                                                onClick={() => openEditar(item)}
                                                className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                                title="Editar horário"
                                            >
                                                <Edit3 size={18} />
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete(item.id)}
                                                className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                                title="Cancelar agendamento"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal Confirmar Cancelamento */}
            <AnimatePresence>
                {confirmDelete && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-4"
                        onClick={() => setConfirmDelete(null)}
                    >
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl space-y-4"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Cancelar agendamento?</h3>
                                <button onClick={() => setConfirmDelete(null)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Esta ação irá cancelar sua consulta. Você poderá agendar uma nova consulta depois.
                            </p>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                                >
                                    Manter
                                </button>
                                <button
                                    onClick={() => handleCancelar(confirmDelete)}
                                    disabled={deleting}
                                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition disabled:opacity-70"
                                >
                                    {deleting ? "Cancelando..." : "Sim, cancelar"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal Editar Horário */}
            <AnimatePresence>
                {editingId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center"
                        onClick={() => { setEditingId(null); setEditSuccess(false); }}
                    >
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
                        >
                            {editSuccess ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                                        <CheckCircle className="w-10 h-10 text-green-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-green-600 mb-2">Reagendado!</h3>
                                    <p className="text-gray-600 dark:text-gray-400 mb-6">Sua consulta foi remarcada com sucesso.</p>
                                    <button
                                        onClick={() => { setEditingId(null); setEditSuccess(false); }}
                                        className="w-full py-4 bg-[#009AA0] text-white font-bold rounded-xl"
                                    >
                                        Fechar
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-5">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            <Edit3 size={20} className="text-blue-500" />
                                            Editar Horário
                                        </h3>
                                        <button onClick={() => setEditingId(null)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                                            <X size={20} className="text-gray-500" />
                                        </button>
                                    </div>

                                    {loadingSlots ? (
                                        <div className="flex justify-center py-10">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#009AA0]" />
                                        </div>
                                    ) : (
                                        <div className="space-y-5">
                                            <div className={`rounded-xl overflow-hidden shadow border ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                                                <SimpleCalendar
                                                    value={selectedDay}
                                                    onChange={(day) => { setSelectedDay(day); setSelectedSlot(null); }}
                                                    colorPrimary="#009AA0"
                                                    colorPrimaryLight="#e3f4fc"
                                                />
                                            </div>

                                            {selectedDay && (
                                                <div>
                                                    <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                                                        <Clock size={16} /> Horários disponíveis
                                                    </h4>
                                                    {daySlots.length > 0 ? (
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {daySlots.map(slot => (
                                                                <button
                                                                    key={slot.slot_id}
                                                                    onClick={() => setSelectedSlot(slot)}
                                                                    className={`p-2 rounded-lg text-sm font-medium transition-all ${selectedSlot?.slot_id === slot.slot_id
                                                                        ? "bg-[#009AA0] text-white shadow-md scale-105"
                                                                        : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                                                                        }`}
                                                                >
                                                                    {new Date(slot.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-center text-sm text-gray-500 italic py-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                                            Nenhum horário disponível nesta data.
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            <button
                                                onClick={handleSalvarHorario}
                                                disabled={!selectedSlot || saving}
                                                className="w-full py-4 bg-[#009AA0] hover:bg-[#00888d] text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {saving ? "Salvando..." : "Confirmar novo horário"}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
