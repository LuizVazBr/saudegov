"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";
import HeaderIn from "@/components/HeaderIn";
import BottomSheetModal from "@/components/BottomSheetModal";
import { FiMessageCircle, FiEye } from "react-icons/fi";
import toast, { Toaster } from "react-hot-toast";
import type { Session } from "next-auth";

interface Instrucao {
    instrucao: string;
    horario: string;
    quantidade: number;
    tipo: string;
}

interface Tratamento {
    id: string;
    nome: string;
    medicamento: string;
    dosagem?: string;
    instrucoes: Instrucao[];
    historico?: { data_inicio: string };
}

interface ClientTratamentosProps {
    sessionServer: Session;
}

export default function ClientTratamentos({ sessionServer }: ClientTratamentosProps) {
    const { data: session } = useSession();
    const { tema } = useTheme();

    const [tratamentos, setTratamentos] = useState<Tratamento[]>([]);
    const [modalAberto, setModalAberto] = useState(false);
    const [tratamentoSelecionado, setTratamentoSelecionado] = useState<Tratamento | null>(null);
    const [loading, setLoading] = useState(true);
    const [iniciando, setIniciando] = useState<string | null>(null);

    const abrirModal = (tratamento: Tratamento) => {
        setTratamentoSelecionado(tratamento);
        setModalAberto(true);
    };

    const fecharModal = () => {
        setModalAberto(false);
        setTratamentoSelecionado(null);
    };

    useEffect(() => {
        const fetchTratamentos = async () => {
            if (!session?.user?.id) return;
            try {
                const res = await fetch(`/api/tratamentos?usuario_id=${session.user.id}`);
                const data: Tratamento[] = await res.json();
                setTratamentos(data);
            } catch (err) {
                console.error("Erro ao buscar tratamentos:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchTratamentos();
    }, [session?.user?.id]);

    const iniciarTratamento = async (tratamentoId: string) => {
        setIniciando(tratamentoId);
        const toastId = toast.loading("Atualizando...");

        try {
            const res = await fetch("/api/historico_tratamentos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tratamento_id: tratamentoId }),
            });
            const historico = await res.json();

            setTratamentos((prev) =>
                prev.map((t) =>
                    t.id === tratamentoId ? { ...t, historico: { data_inicio: historico.data_inicio } } : t
                )
            );

            toast.dismiss(toastId);
            toast.success("Tratamento iniciado com sucesso!");
        } catch (err) {
            console.error("Erro ao iniciar tratamento:", err);
            toast.dismiss(toastId);
            toast.error("Erro ao iniciar tratamento");
        } finally {
            setIniciando(null);
        }
    };

    const formatarHoraAntes = (horario: string, horasAntes = 1) => {
        const [h, m] = horario.split(":").map(Number);
        const data = new Date();
        data.setHours(h, m, 0, 0);
        data.setHours(data.getHours() - horasAntes);
        return data.toTimeString().slice(0, 5);
    };

    return (
        <div className={`min-h-screen bg-gray-50 dark:bg-gray-900`}>
            <HeaderIn paginaAtiva="tratamentos" tipoU="" sessionServer={sessionServer} />
            <Toaster position="top-right" />
            <div className="px-5 py-6">
                <h1 className={`text-2xl font-semibold ${tema.textPrimary} mb-4`}>Meus Tratamentos</h1>
                <p className={`text-sm text-gray-600 dark:text-gray-300 mb-6`}>
                    Aqui estão seus tratamentos cadastrados. Você receberá lembretes e instruções detalhadas para seguir cada medicação corretamente.
                </p>

                {loading ? (
                    <p>Carregando tratamentos...</p>
                ) : tratamentos.length === 0 ? (
                    <p className="text-gray-600 dark:text-gray-300">Nenhum tratamento cadastrado.</p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
                        {tratamentos.map((t) => (
                            <div
                                key={t.id}
                                className={`relative p-5 rounded-xl shadow-lg border ${tema.borderColor} bg-white dark:bg-gray-800 hover:shadow-2xl transition flex flex-col`}
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h2 className={`text-md font-semibold ${tema.textPrimary}`}>{t.nome}</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                                            {t.medicamento} {t.dosagem ? ` ${t.dosagem}` : ""}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <FiEye
                                            className="text-gray-400 dark:text-gray-300 hover:text-blue-500 transition cursor-pointer"
                                            size={22}
                                            onClick={() => abrirModal(t)}
                                        />
                                        {!t.historico && (
                                            <button
                                                onClick={() => iniciarTratamento(t.id)}
                                                className="bg-blue-500 text-white text-sm px-3 py-1 rounded hover:bg-blue-600 transition flex items-center"
                                                disabled={iniciando === t.id}
                                            >
                                                {iniciando === t.id ? "Iniciando..." : "Iniciar"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {t.historico && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                        Tratamento iniciado em: {new Date(t.historico.data_inicio).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modalAberto && tratamentoSelecionado && (
                <BottomSheetModal isOpen={modalAberto} onClose={fecharModal} className="p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-gray-800">{tratamentoSelecionado.nome}</h2>
                        <button onClick={fecharModal} className="p-1 rounded-full hover:bg-gray-200 transition">
                            ✕
                        </button>
                    </div>

                    <div className="mt-2">
                        {tratamentoSelecionado.instrucoes.length === 0 ? (
                            <p className="text-sm text-gray-600 dark:text-gray-300">Nenhuma instrução cadastrada.</p>
                        ) : (
                            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
                                {tratamentoSelecionado.instrucoes.map((i, idx) => (
                                    <li key={idx} className="mb-1">
                                        {i.instrucao}
                                        {i.tipo === "medicamento" && (
                                            <> — Horário: {i.horario.slice(0, 5)} — {i.quantidade}x ao dia</>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {tratamentoSelecionado.historico && (
                        <div className="flex items-center gap-4 mt-4">
                            <FiMessageCircle className="text-blue-500 text-xl" />
                            {tratamentoSelecionado.instrucoes[0] && (
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    Lembrete: {formatarHoraAntes(tratamentoSelecionado.instrucoes[0].horario)} (1 hora antes via WhatsApp)
                                </p>
                            )}
                        </div>
                    )}

                    <button
                        onClick={fecharModal}
                        className={`w-full mt-6 py-3 rounded-md text-white font-semibold transition
              ${tema.btnBg} ${tema.btnHover}`}
                    >
                        Fechar
                    </button>
                </BottomSheetModal>
            )}
        </div>
    );
}
