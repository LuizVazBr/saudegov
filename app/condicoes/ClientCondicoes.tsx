"use client";

import { useState, useEffect } from "react";
import { FiEye } from "react-icons/fi";
import HeaderCondicoes from "@/components/HeaderIn";
import BottomSheetModal from "@/components/BottomSheetModal";
import { useTheme } from "@/components/ThemeProvider";
import { useAudioPlayer } from "@/components/AudioPlayer";
import type { Session } from "next-auth";

type Condicao = {
    id: string;
    nome: string;
    descricao: string;
    desde: string | null;
};

interface ClientCondicoesProps {
    sessionServer?: Session | null;
}

export default function ClientCondicoes({ sessionServer }: ClientCondicoesProps) {
    const { tema } = useTheme();
    const { audioHabilitado, toggleAudio } = useAudioPlayer(tema);

    const [condicoes, setCondicoes] = useState<Condicao[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalAberto, setModalAberto] = useState(false);
    const [condicaoSelecionada, setCondicaoSelecionada] = useState<Condicao | null>(null);

    useEffect(() => {
        async function fetchCondicoes() {
            try {
                const res = await fetch("/api/condicoes");
                const data = await res.json();
                setCondicoes(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }

        fetchCondicoes();
    }, []);

    const abrirModal = (condicao: Condicao) => {
        setCondicaoSelecionada(condicao);
        setModalAberto(true);
    };

    const fecharModal = () => {
        setModalAberto(false);
        setCondicaoSelecionada(null);
    };

    return (
        <div className={`min-h-screen bg-gray-50 dark:bg-gray-900`}>
            <HeaderCondicoes paginaAtiva="condicoes" tipoU="" sessionServer={sessionServer} />

            <div className="px-5 py-6">
                <h1 className={`text-2xl font-semibold ${tema.textPrimary} mb-4`}>Condições</h1>

                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                    Suas condições de saúde ajudam a orientar cuidados e procedimentos de forma segura e personalizada.
                </p>

                {loading ? (
                    <p>Carregando condições...</p>
                ) : condicoes.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">Nenhuma condição cadastrada.</p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
                        {condicoes.map((c) => (
                            <div
                                key={c.id}
                                className={`relative p-5 rounded-xl shadow-lg border ${tema.borderColor} bg-white dark:bg-gray-800 hover:shadow-2xl transition flex items-center justify-between`}
                            >
                                <div>
                                    <h2 className={`text-md font-semibold ${tema.textPrimary}`}>{c.nome}</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                                        Tenho desde: {c.desde ? new Date(c.desde).toLocaleDateString() : "-"}
                                    </p>
                                </div>
                                <FiEye
                                    className="text-gray-400 dark:text-gray-300 hover:text-blue-500 transition cursor-pointer"
                                    size={22}
                                    onClick={() => abrirModal(c)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modalAberto && condicaoSelecionada && (
                <BottomSheetModal isOpen={modalAberto} onClose={fecharModal} className="p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-gray-800">{condicaoSelecionada.nome}</h2>
                        <button onClick={fecharModal} className="p-1 rounded-full hover:bg-gray-200 transition">
                            ✕
                        </button>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto pr-2">
                        <p className="text-sm text-gray-600 leading-relaxed">{condicaoSelecionada.descricao}</p>
                    </div>

                    <button
                        onClick={fecharModal}
                        className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-md transition"
                    >
                        Fechar
                    </button>
                </BottomSheetModal>
            )}
        </div>
    );
}
