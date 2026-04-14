"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, Clock, CheckCircle } from "lucide-react";
import BottomSheetModal from "./BottomSheetModal";
import { SimpleCalendar, Day } from "./SimpleCalendar";
import { toast } from "react-hot-toast";

interface AgendamentoModalProps {
    isOpen: boolean;
    onClose: () => void;
    pacienteId: string;
    darkMode: boolean;
}

interface Slot {
    slot_id: string;
    data_hora: string;
    medico_nome: string;
    medico_id: string;
}

interface DoctorInfo {
    nome: string;
    especialidade: string;
    crm: string;
    foto?: string;
}

const AgendamentoModal: React.FC<AgendamentoModalProps> = ({
    isOpen,
    onClose,
    pacienteId,
    darkMode,
}) => {
    const [selectedDay, setSelectedDay] = useState<Day | null>(null);
    const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<"date" | "confirm" | "success">("date");
    const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchSlots();
            setStep("date");
            setSelectedSlot(null);

            // Auto-select today's date
            const today = new Date();
            setSelectedDay({
                year: today.getFullYear(),
                month: today.getMonth() + 1,
                day: today.getDate()
            });
        }
    }, [isOpen]);

    const fetchSlots = async () => {
        // console.log('[AgendamentoModal] fetchSlots called');
        setLoading(true);
        try {
            const res = await fetch("/api/agendamentos/disponibilidade");
            const data = await res.json();
            // console.log('[AgendamentoModal] API response:', data);

            if (Array.isArray(data) && data.length > 0) {
                // console.log('[AgendamentoModal] Setting availableSlots:', data);
                setAvailableSlots(data);

                // Get doctor info directly from first slot (now included in API response)
                const firstSlot = data[0];
                // console.log('[AgendamentoModal] First slot:', firstSlot);

                const doctorData = {
                    nome: firstSlot.medico_nome,
                    especialidade: firstSlot.especialidade,
                    crm: `${firstSlot.crm}-${firstSlot.estado_atuacao}`,
                    foto: firstSlot.foto
                };
                // console.log('[AgendamentoModal] Setting doctor info:', doctorData);
                setDoctorInfo(doctorData);
            } else {
                // console.log('[AgendamentoModal] No slots found or invalid data');
            }
        } catch (error) {
            console.error("[AgendamentoModal] Erro ao buscar horários", error);
            toast.error("Erro ao carregar horários disponíveis");
        } finally {
            setLoading(false);
        }
    };

    const handleDaySelect = (day: Day) => {
        setSelectedDay(day);
        setSelectedSlot(null);
    };

    const getSlotsForSelectedDay = () => {
        if (!selectedDay) {
            // console.log('[AgendamentoModal] No day selected');
            return [];
        }

        // console.log('[AgendamentoModal] Selected day:', selectedDay);
        // console.log('[AgendamentoModal] Available slots:', availableSlots);

        const filtered = availableSlots.filter((slot) => {
            const date = new Date(slot.data_hora);
            const matches = (
                date.getDate() === selectedDay.day &&
                date.getMonth() + 1 === selectedDay.month &&
                date.getFullYear() === selectedDay.year
            );
            // console.log(`[AgendamentoModal] Slot ${slot.data_hora}: date=${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} matches=${matches}`);
            return matches;
        });

        // console.log('[AgendamentoModal] Filtered slots for selected day:', filtered);
        return filtered;
    };

    const handleConfirm = async () => {
        if (!selectedSlot) return;
        setLoading(true);
        try {
            const res = await fetch("/api/agendamentos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    paciente_id: pacienteId,
                    medico_id: selectedSlot.medico_id,
                    data_hora: selectedSlot.data_hora,
                }),
            });

            if (res.ok) {
                setStep("success");
            } else {
                const err = await res.json();
                toast.error(err.error || "Erro ao agendar consulta");
            }
        } catch (error) {
            toast.error("Erro de conexão");
        } finally {
            setLoading(false);
        }
    };

    const currentSlots = getSlotsForSelectedDay();

    return (
        <BottomSheetModal isOpen={isOpen} onClose={onClose}>
            <div className="w-full max-h-[60vh] overflow-y-auto px-1">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black flex items-center gap-2 text-primary tracking-tighter uppercase">
                        <Calendar className="w-6 h-6" />
                        Agendar Telemedicina
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-black/5 transition-colors"
                    >
                        <X className="w-6 h-6 text-gray-400" strokeWidth={3} />
                    </button>
                </div>

                {/* Doctor Profile Section */}
                {doctorInfo && (
                    <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                {doctorInfo.foto ? (
                                    <img src={doctorInfo.foto} alt={doctorInfo.nome} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600 text-2xl font-bold">
                                        {doctorInfo.nome.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200">{doctorInfo.nome}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{doctorInfo.especialidade}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{doctorInfo.crm}</p>
                            </div>
                        </div>
                    </div>
                )}

                {step === "date" && (
                    <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className={`rounded-xl overflow-hidden shadow-lg border-2 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                            <SimpleCalendar
                                value={selectedDay}
                                onChange={handleDaySelect}
                                colorPrimary="#009AA0"
                                colorPrimaryLight="#e3f4fc"
                            />
                        </div>

                        {selectedDay && (
                            <div className="w-full space-y-3 px-1">
                                <h4 className="font-semibold text-lg flex items-center gap-2">
                                    <Clock size={18} /> Horários disponíveis
                                </h4>
                                {currentSlots.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-2">
                                        {currentSlots.map((slot) => {
                                            const isPast = new Date(slot.data_hora).getTime() < Date.now();
                                            return (
                                                <button
                                                    key={slot.slot_id}
                                                    onClick={() => !isPast && setSelectedSlot(slot)}
                                                    disabled={isPast}
                                                    className={`p-2 rounded-lg text-sm font-medium transition-all ${selectedSlot?.slot_id === slot.slot_id
                                                        ? "bg-[#009AA0] text-white shadow-md scale-105"
                                                        : isPast
                                                            ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 opacity-40 cursor-not-allowed line-through"
                                                            : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-transparent hover:border-[#009AA0]/30"
                                                        }`}
                                                >
                                                    {new Date(slot.data_hora).toLocaleTimeString("pt-BR", {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-center italic py-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                        Nenhum horário disponível nesta data.
                                    </p>
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => setStep("confirm")}
                            disabled={!selectedSlot}
                            className="w-full py-4 font-bold text-lg primary-gradient text-white rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:shadow-none mt-4"
                        >
                            Continuar
                        </button>
                    </div>
                )}

                {step === "confirm" && selectedSlot && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                            <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-4">Confirme seu agendamento</h4>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-blue-200 dark:border-blue-800/50 pb-3">
                                    <span className="text-gray-600 dark:text-gray-400">Médico</span>
                                    <span className="font-bold text-lg">{selectedSlot.medico_nome}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-blue-200 dark:border-blue-800/50 pb-3">
                                    <span className="text-gray-600 dark:text-gray-400">Data</span>
                                    <span className="font-bold text-lg">
                                        {new Date(selectedSlot.data_hora).toLocaleDateString("pt-BR")}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600 dark:text-gray-400">Horário</span>
                                    <span className="font-bold text-lg">
                                        {new Date(selectedSlot.data_hora).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setStep("date")}
                                className="flex-1 py-3 font-semibold border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={loading}
                                className="flex-1 py-3 font-bold primary-gradient text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] disabled:opacity-70"
                            >
                                {loading ? "Confirmando..." : "Confirmar Agendamento"}
                            </button>
                        </div>
                    </div>
                )}

                {step === "success" && (
                    <div className="flex flex-col items-center justify-center py-8 text-center animate-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle className="w-10 h-10 text-green-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-green-600 mb-2">Agendamento Confirmado!</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-xs mx-auto">
                            Sua consulta de telemedicina foi agendada com sucesso. Você receberá um lembrete antes do horário.
                        </p>
                        <button
                            onClick={onClose}
                            className="w-full py-4 font-bold primary-gradient text-white rounded-xl shadow-lg hover:scale-[1.02] transition-transform"
                        >
                            Fechar
                        </button>
                    </div>
                )}
            </div>
        </BottomSheetModal>
    );
};

export default AgendamentoModal;
