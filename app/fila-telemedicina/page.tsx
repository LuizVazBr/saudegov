"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter } from "next/navigation";
import { FiCheckCircle, FiClock, FiVideo, FiAlertCircle, FiArrowLeft } from "react-icons/fi";
import HeaderIn from "@/components/HeaderIn";

function FilaTelemedicinaContent() {
    const router = useRouter();
    const [pacienteId, setPacienteId] = useState<string | null>(null);

    const [posicao, setPosicao] = useState<number | null>(null);
    const [naFrente, setNaFrente] = useState<number | null>(null);
    const [tempoEstimado, setTempoEstimado] = useState<number | null>(null);
    const [tempoEstimadoSegundos, setTempoEstimadoSegundos] = useState<number | null>(null);
    const [status, setStatus] = useState<string>("carregando"); // carregando, aguardando, chamado, expirado
    const [medicosOnline, setMedicosOnline] = useState(true);
    const [countdownRedirect, setCountdownRedirect] = useState(5);
    const [tempoRestante, setTempoRestante] = useState(120);
    const [roomName, setRoomName] = useState("");
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const hasNotifiedRef = useRef(false);

    useEffect(() => {
        const id = sessionStorage.getItem("pacienteIdFila");
        if (id) {
            setPacienteId(id);
        } else {
            router.push("/");
        }
    }, [router]);

    useEffect(() => {
        let interval: NodeJS.Timeout;

        const fetchFilaStatus = async () => {
            if (!pacienteId) return;
            try {
                const res = await fetch(`/api/fila/status?pacienteId=${pacienteId}`, {
                    cache: "no-store",
                    headers: {
                        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                        Pragma: "no-cache",
                        Expires: "0",
                    }
                });
                const data = await res.json();

                if (data.status === "chamado" || data.status === "em_atendimento") {
                    if (!hasNotifiedRef.current && data.status === "em_atendimento") {
                        hasNotifiedRef.current = true;
                        // Reproduzir notificação local
                        if ("Notification" in window && Notification.permission === "granted") {
                            new Notification("Sua Consulta Chegou!", {
                                body: "O médico está te esperando para a consulta online. Você tem 2 minutos para entrar."
                            });
                        } else if ("Notification" in window && Notification.permission !== "denied") {
                            Notification.requestPermission();
                        }
                    }

                    setStatus(data.status);
                    setRoomName(data.roomName);
                    setTempoRestante(data.tempoRestante);

                    if (data.status === "em_atendimento" && data.tempoRestante <= 0) {
                        setStatus("expirado");
                    }
                } else if (data.status === "aguardando") {
                    setStatus("aguardando");
                    setPosicao(data.posicao);
                    setNaFrente(data.naFrente);
                    setTempoEstimado(data.tempoEstimadoMinutos);
                    if (data.tempoEstimadoSegundos !== undefined) {
                        if (tempoEstimadoSegundos === null || Math.abs(tempoEstimadoSegundos - data.tempoEstimadoSegundos) > 10) {
                            setTempoEstimadoSegundos(data.tempoEstimadoSegundos);
                        }
                    }
                } else if (data.status === "ausente" || data.status === "finalizado") {
                    setStatus("expirado");
                } else {
                    // not found
                    setStatus("expirado");
                }
            } catch (e) {
                console.error("Erro ao checar fila", e);
            }
        };

        if (pacienteId) {
            fetchFilaStatus();
            interval = setInterval(fetchFilaStatus, 5000); // 5 sec poll
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [pacienteId]);

    useEffect(() => {
        let interval: NodeJS.Timeout;

        const checkDisponibilidade = async () => {
            try {
                const res = await fetch("/api/fila/status-medicos?t=" + Date.now());
                const data = await res.json();
                setMedicosOnline(!!data.medicos_online);
            } catch (e) {
                console.error("Erro ao checar disponibilidade:", e);
            }
        };

        checkDisponibilidade();
        interval = setInterval(checkDisponibilidade, 10000); // Poll a cada 10s

        return () => clearInterval(interval);
    }, []);

    // Countdown de redirecionamento se indisponível
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (!medicosOnline && status !== "chamado" && status !== "em_atendimento") {
            timer = setInterval(() => {
                setCountdownRedirect((prev) => {
                    if (prev <= 1) {
                        router.push("/");
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [medicosOnline, status, router]);

    // Contagem regressiva do tempo estimado (fila)
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (status === "aguardando" && tempoEstimadoSegundos !== null && tempoEstimadoSegundos > 0) {
            timer = setInterval(() => {
                setTempoEstimadoSegundos((prev) => (prev && prev > 0 ? prev - 1 : 0));
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [status, tempoEstimadoSegundos]);

    const formatTempo = (segundos: number | null) => {
        if (segundos === null) return "--:--";
        if (posicao === 1 || segundos < 60) return "Menos de 1 min";
        const mins = Math.floor(segundos / 60);
        const secs = segundos % 60;
        return `${mins}:${secs.toString().padStart(2, "0")} min`;
    };

    const handleEntrarConsulta = async () => {
        try {
            // Ir direto pra sala. O médico é quem altera o status pra 'em_atendimento'.
            router.push(`/teleconsulta/sala?room=${roomName}`);
        } catch {
            alert("Erro ao entrar na sala. Tente novamente.");
        }
    };

    const handleCancelarVoltar = async (voltarApenas = false) => {
        if (!voltarApenas) {
            setIsCancelModalOpen(true);
            return;
        }
        executeCancel();
    };

    const executeCancel = async () => {
        if (pacienteId && (status === "aguardando" || status === "chamado" || status === "em_atendimento")) {
            try {
                await fetch(`/api/fila/status`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pacienteId, novoStatus: "cancelado" })
                });
            } catch (e) {
                console.error("Erro ao cancelar fila", e);
            }
        }

        sessionStorage.removeItem("pacienteIdFila");
        sessionStorage.setItem("telemed_cancelled", "true"); // Flag para o ClientApp limpar o Header imediatamente
        setIsCancelModalOpen(false);
        router.push("/");
    };


    if (!medicosOnline && status !== "chamado" && status !== "em_atendimento") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-6 text-center">
                <FiAlertCircle className="text-amber-500 w-24 h-24 mb-6" />
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2">Atendimento Indisponível</h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md">
                    No momento não há médicos disponíveis para atendimento online. 
                    Por favor, tente novamente mais tarde ou dirija-se a uma unidade física.
                </p>
                <p className="mt-4 text-blue-600 font-semibold animate-pulse text-xl">
                    Redirecionando para o início em {countdownRedirect}s...
                </p>
                <button
                    onClick={() => router.push("/")}
                    className="mt-8 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-700 dark:text-gray-200 font-bold py-3 px-8 rounded-lg transition"
                >
                    Voltar agora
                </button>
            </div>
        );
    }

    if (status === "carregando") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-500 text-lg">Conectando à sala de telemedicina...</p>
            </div>
        );
    }

    if (status === "expirado") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-6 text-center">
                <FiAlertCircle className="text-red-500 w-24 h-24 mb-6" />
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2">Sessão Expirada</h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md">
                    O tempo limite de 2 minutos para entrar na consulta acabou ou você não está mais na fila de espera.
                </p>
                <button
                    onClick={() => router.push("/")}
                    className="mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg"
                >
                    Voltar ao Início
                </button>
            </div>
        );
    }

    if (status === "chamado") {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-6 text-center">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2">O profissional está se preparando!</h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md">
                    O médico já chamou você e está organizando a sala. Fique nesta página, logo abriremos a chamada e começará a contar o tempo limite de 2 minutos para entrar.
                </p>
            </div>
        );
    }

    if (status === "em_atendimento") {
        return (
            <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
                <HeaderIn paginaAtiva="telemedicina" tipoU="paciente" />
                <div className="flex flex-col items-center justify-center py-12 px-4 relative pb-24">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-10 shadow-2xl flex flex-col items-center text-center max-w-lg w-full border border-green-100 dark:border-green-800/50 animate-in zoom-in duration-500">
                        <div className="relative">
                            <div className="w-32 h-32 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                <FiVideo className="text-green-600 dark:text-green-400 w-16 h-16" />
                            </div>
                            {/* Timer Badge */}
                            <div className="absolute -top-2 -right-2 bg-red-500 text-white font-black text-xl w-12 h-12 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-lg animate-bounce">
                                {tempoRestante}
                            </div>
                        </div>

                        <h2 className="text-4xl font-black text-green-600 dark:text-green-400 mb-4">
                            Chegou a sua vez!
                        </h2>
                        <p className="text-gray-600 dark:text-gray-300 text-lg mb-8">
                            O médico já está na sala aguardando você iniciar a chamada de vídeo.
                        </p>

                        <button
                            onClick={handleEntrarConsulta}
                            className="w-full bg-green-500 hover:bg-green-600 text-white font-black text-xl py-5 rounded-2xl shadow-xl transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                        >
                            <FiVideo className="w-6 h-6" /> Entrar na Consulta
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <HeaderIn paginaAtiva="telemedicina" tipoU="paciente" />
            <div className="flex flex-col items-center py-12 px-4 relative pb-24">
                {/* Header / Voltar */}
                <div className="w-full max-w-md mb-4 flex justify-start">
                    <button
                        onClick={() => router.push("/")}
                        className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 transition"
                    >
                        <FiArrowLeft className="w-6 h-6" /> Voltar
                    </button>
                </div>

                <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="bg-blue-600 text-white p-6 text-center">
                        <h1 className="text-2xl font-bold">Fila da Telemedicina</h1>
                        <p className="opacity-80 text-sm mt-1">Acompanhe sua posição ao vivo</p>
                    </div>

                    <div className="p-8 flex flex-col items-center">
                        <p className="text-gray-500 dark:text-gray-400 uppercase text-xs font-bold tracking-wider mb-2">
                            Sua Posição
                        </p>
                        <div className="text-8xl font-black text-blue-600 dark:text-blue-400 mb-6 drop-shadow-sm">
                            {posicao}º
                        </div>

                        <div className="w-full h-px bg-gray-200 dark:bg-gray-700 my-6" />

                        <div className="w-full space-y-4">
                            <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                        <FiClock className="text-yellow-600 dark:text-yellow-400" />
                                    </div>
                                    <span className="font-medium">Tempo estimado</span>
                                </div>
                                <span className="font-bold text-lg">{formatTempo(tempoEstimadoSegundos)}</span>
                            </div>

                            <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        <FiCheckCircle className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <span className="font-medium">Pacientes na frente</span>
                                </div>
                                <span className="font-bold text-lg">{naFrente}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/50 p-6 border-t border-gray-100 dark:border-gray-700 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {posicao === 1 ? (
                                <>O profissional está organizando a sala para te chamar, aguarde um pouco.</>
                            ) : (
                                <>Mantenha esta página aberta. Quando chegar a sua vez, você terá <strong>2 minutos</strong> para entrar na sala em vídeo.</>
                            )}
                        </p>
                    </div>
                </div>

                {posicao !== null && posicao > 1 && (
                    <div className="w-full max-w-md mt-6 space-y-4">
                        {tempoEstimadoSegundos !== null && tempoEstimadoSegundos > 300 && (
                            <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 rounded-3xl shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                    <span className="text-xl">💡</span> Dica Amiga
                                </h3>
                                <p className="text-sm opacity-90 leading-relaxed mb-4">
                                    Enquanto aguarda sua vez, que tal realizar alguns autoexames rápidos para agilizar seu atendimento?
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: "Teste Cardíaco", icon: "❤️", url: "/autoexame/cardiovascular" },
                                        { label: "Sinal de Frank", icon: "👂", url: "/autoexame/frank" },
                                        { label: "Análise da Língua", icon: "👅", url: "/autoexame/lingua" },
                                        { label: "Análise das Unhas", icon: "💅", url: "/autoexame/unhas" },
                                        { label: "Relaxamento", icon: "🧘", url: "/autoexame/relaxamento" },
                                        { label: "Mapeamento da Dor", icon: "📍", url: "/autoexame/dor" },
                                    ].map((item) => (
                                        <button
                                            key={item.label}
                                            onClick={() => router.push(item.url)}
                                            className="bg-white/20 hover:bg-white/30 p-2 rounded-xl text-[10px] font-bold transition flex items-center gap-2"
                                        >
                                            <span>{item.icon}</span> {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => router.push("/historico")}
                            className="w-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 py-3 rounded-xl font-bold hover:bg-blue-100 dark:hover:bg-blue-900 transition shadow-sm"
                        >
                            Anexar Exames Adicionais
                        </button>
                    </div>
                )}

                {/* Fixed Footer Cancelar */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 flex justify-center">
                    <button
                        onClick={() => setIsCancelModalOpen(true)}
                        className="w-full max-w-md bg-red-600 text-white hover:bg-red-700 font-bold py-3 rounded-lg shadow-sm transition"
                    >
                        Cancelar e sair da fila
                    </button>
                </div>

                {/* Modal Cancelar */}
                {isCancelModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm px-4">
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in duration-300">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                                    <FiAlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Cancelar o atendimento?</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium text-sm">Você será removido da fila e precisará entrar novamente caso precise de consultoria.</p>
                                
                                <div className="flex w-full gap-3 flex-col sm:flex-row">
                                    <button 
                                        onClick={() => setIsCancelModalOpen(false)}
                                        className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                                    >
                                        Voltar
                                    </button>
                                    <button 
                                        onClick={executeCancel}
                                        className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition"
                                    >
                                        Sim, cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function FilaTelemedicinaPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">Carregando fila...</div>}>
            <FilaTelemedicinaContent />
        </Suspense>
    )
}
