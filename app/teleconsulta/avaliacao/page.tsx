"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiStar, FiCheckCircle } from "react-icons/fi";
import { useTheme } from "@/components/ThemeProvider";
import toast, { Toaster } from "react-hot-toast";

export default function AvaliacaoTelemedicinaPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { tema } = useTheme();

    const [pacienteId, setPacienteId] = useState<string | null>(null);
    const [roomName, setRoomName] = useState<string | null>(null);

    // Form State
    const [nota, setNota] = useState<number>(0);
    const [hoverNota, setHoverNota] = useState<number>(0);
    const [foiCordial, setFoiCordial] = useState<boolean | null>(null);
    const [entendeuProblema, setEntendeuProblema] = useState<boolean | null>(null);
    const [satisfeito, setSatisfeito] = useState<boolean | null>(null);
    const [observacao, setObservacao] = useState("");

    const [enviando, setEnviando] = useState(false);
    const [sucesso, setSucesso] = useState(false);

    useEffect(() => {
        const urlPacienteId = searchParams.get("pacienteId");
        const urlRoom = searchParams.get("room");

        if (urlPacienteId) setPacienteId(urlPacienteId);
        else {
            const storedPid = sessionStorage.getItem("pacienteId");
            if (storedPid) setPacienteId(storedPid);
        }

        if (urlRoom) setRoomName(urlRoom);
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (nota === 0) {
            toast.error("Por favor, selecione uma nota de 1 a 5 estrelas.");
            return;
        }

        setEnviando(true);
        try {
            const res = await fetch("/api/teleconsulta/avaliacao", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pacienteId,
                    roomName,
                    nota,
                    foi_cordial: foiCordial,
                    entendeu_problema: entendeuProblema,
                    satisfeito: satisfeito,
                    observacao
                })
            });

            if (res.ok) {
                setSucesso(true);
            } else {
                toast.error("Erro ao enviar avaliação. Tente novamente.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Falha na comunicação com o servidor.");
        } finally {
            setEnviando(false);
        }
    };

    if (sucesso) {
        return (
            <div className={`min-h-screen ${tema.mainBg} flex items-center justify-center p-6`}>
                <div className={`max-w-md w-full p-8 rounded-2xl shadow-xl bg-white dark:bg-gray-800 border ${tema.borderColor} text-center flex flex-col items-center`}>
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mb-6">
                        <FiCheckCircle className="w-12 h-12 text-green-500" />
                    </div>
                    <p className="text-gray-900 dark:text-gray-100 mb-8 text-xl font-medium leading-relaxed">
                        É você, paciente, que faz nosso atendimento ficar cada vez melhor.
                    </p>
                    <button
                        onClick={() => router.push("/")}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition w-full shadow-lg"
                    >
                        Voltar para o início
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-[100dvh] bg-gray-50 dark:bg-gray-900 pb-12`}>
            <Toaster />

            {/* Header / Resumo Fixo (Mock UI as requested by user loosely) */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 pt-12 text-center shadow-sm">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Consulta Encerrada</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    Resumo do atendimento, documentos preenchidos na sessão ou receituários estarão disponíveis no seu Histórico.
                </p>
            </div>

            <main className="max-w-2xl mx-auto p-4 sm:p-6 mt-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-1">Avalie o Atendimento</h2>
                        <p className="text-blue-700 dark:text-blue-300 text-sm">Como foi a sua experiência com nosso médico hoje?</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-8">

                        {/* Nota de 1 a 5 */}
                        <div className="flex flex-col items-center justify-center py-4">
                            <label className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">Que nota você dá ao médico?</label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onMouseEnter={() => setHoverNota(star)}
                                        onMouseLeave={() => setHoverNota(0)}
                                        onClick={() => setNota(star)}
                                        className="focus:outline-none transition-transform hover:scale-110 p-1"
                                    >
                                        <FiStar
                                            className={`w-10 h-10 transition-colors ${star <= (hoverNota || nota)
                                                ? "fill-yellow-400 text-yellow-500"
                                                : "text-gray-300 dark:text-gray-600"
                                                }`}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <hr className="border-gray-100 dark:border-gray-700" />

                        {/* Questionário Sim/Não */}
                        <div className="space-y-6">
                            {/* Pergunta 1 */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <span className="font-medium text-gray-700 dark:text-gray-300 text-lg">O médico foi cordial?</span>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFoiCordial(true)}
                                        className={`px-6 py-2 rounded-lg font-medium transition ${foiCordial === true ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    >
                                        Sim
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFoiCordial(false)}
                                        className={`px-6 py-2 rounded-lg font-medium transition ${foiCordial === false ? 'bg-red-500 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    >
                                        Não
                                    </button>
                                </div>
                            </div>

                            {/* Pergunta 2 */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <span className="font-medium text-gray-700 dark:text-gray-300 text-lg">O médico entendeu o seu problema?</span>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setEntendeuProblema(true)}
                                        className={`px-6 py-2 rounded-lg font-medium transition ${entendeuProblema === true ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    >
                                        Sim
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEntendeuProblema(false)}
                                        className={`px-6 py-2 rounded-lg font-medium transition ${entendeuProblema === false ? 'bg-red-500 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    >
                                        Não
                                    </button>
                                </div>
                            </div>

                            {/* Pergunta 3 */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <span className="font-medium text-gray-700 dark:text-gray-300 text-lg">Você ficou satisfeito com o atendimento?</span>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setSatisfeito(true)}
                                        className={`px-6 py-2 rounded-lg font-medium transition ${satisfeito === true ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    >
                                        Sim
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSatisfeito(false)}
                                        className={`px-6 py-2 rounded-lg font-medium transition ${satisfeito === false ? 'bg-red-500 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                    >
                                        Não
                                    </button>
                                </div>
                            </div>
                        </div>

                        <hr className="border-gray-100 dark:border-gray-700" />

                        {/* Observação */}
                        <div>
                            <label className="block font-medium text-gray-700 dark:text-gray-300 text-lg mb-2">
                                Tem alguma observação adicional? <span className="text-gray-400 text-sm font-normal">(Opcional)</span>
                            </label>
                            <textarea
                                value={observacao}
                                onChange={(e) => setObservacao(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none h-32"
                                placeholder="Conte-nos detalhes ou sugira melhorias..."
                            />
                        </div>

                        {/* Botão de Enviar */}
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={enviando || nota === 0}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg transition disabled:opacity-50 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                            >
                                {enviando ? "Enviando..." : "Enviar Avaliação"}
                            </button>
                        </div>

                    </form>
                </div>
            </main>
        </div>
    );
}
