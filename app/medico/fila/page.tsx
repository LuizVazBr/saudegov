"use client";

import { useEffect, useRef, useState } from "react";
import { FiUsers, FiPhoneCall, FiClock, FiAlertCircle, FiClipboard, FiFileText, FiVideo } from "react-icons/fi";
import { toast, Toaster } from "react-hot-toast";
import HeaderIn from "@/components/HeaderIn";
import { useTheme } from "@/components/ThemeProvider";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface PacienteFila {
    id: string;
    paciente_id: string;
    paciente_nome?: string;
    sintomas?: string;
    exames_anexados?: string;
    room_name?: string;
    status: string;
    chamado_em: string;
    data_entrada: string;
}

export default function MedicoFilaPage() {
    const { tema } = useTheme();
    const router = useRouter();
    const { data: session } = useSession();
    const [pacientes, setPacientes] = useState<PacienteFila[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [abaAtual, setAbaAtual] = useState<"aguardando" | "atendidos" | "cancelados">("aguardando");

    // --- 🔔 ÁUDIO ---
    const [soundUnlocked, setSoundUnlocked] = useState(false);
    const audioAguardandoRef = useRef<HTMLAudioElement | null>(null);
    const audioNaSalaRef = useRef<HTMLAudioElement | null>(null);
    // IDs de pacientes já conhecidos para não repetir o som
    const knownAguardandoIds = useRef<Set<string>>(new Set());
    // room_names de pacientes chamados que já tocaram nasala
    const knownNaSalaRooms = useRef<Set<string>>(new Set());

    // Inicializa objetos de Audio após montar
    useEffect(() => {
        audioAguardandoRef.current = new Audio("/audios/aguardando.mp3");
        audioNaSalaRef.current = new Audio("/audios/nasala.mp3");
        audioAguardandoRef.current.preload = "auto";
        audioNaSalaRef.current.preload = "auto";
    }, []);

    const playSound = (ref: React.MutableRefObject<HTMLAudioElement | null>) => {
        if (!soundUnlocked || !ref.current) return;
        ref.current.currentTime = 0;
        ref.current.play().catch(() => {
            // Bloqueado pelo navegador – precisa de interação do usuário
        });
    };

    const fetchFila = async () => {
        try {
            const res = await fetch("/api/fila/medico?t=" + Date.now(), {
                cache: "no-store",
                headers: {
                    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                    Pragma: "no-cache",
                    Expires: "0",
                },
            });
            if (!res.ok) {
                console.error("Erro na API da fila:", res.status);
                return;
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                setPacientes(data);
            }
        } catch (e) {
            console.error("Erro ao buscar fila:", e);
        } finally {
            setCarregando(false);
        }
    };

    // Proteção de Rota: Somente Médicos
    useEffect(() => {
        if (session) {
            const tipo = session.user?.tipo_usuario?.toLowerCase();
            if (tipo !== "medico") {
                router.push("/");
            }
        }
    }, [session, router]);

    useEffect(() => {
        fetchFila();
        // Polling rápido a cada 3 segundos
        const interval = setInterval(fetchFila, 3000);
        return () => clearInterval(interval);
    }, []);

    // --- Detecta novos pacientes aguardando ---
    useEffect(() => {
        if (!soundUnlocked) return;
        const aguardandoAgora = pacientes.filter(p => p.status === "aguardando");
        let algumNovo = false;
        aguardandoAgora.forEach(p => {
            if (!knownAguardandoIds.current.has(p.id)) {
                knownAguardandoIds.current.add(p.id);
                algumNovo = true;
            }
        });
        if (algumNovo) playSound(audioAguardandoRef);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pacientes, soundUnlocked]);

    // --- Detecta quando paciente chamado entra na sala (-online) ---
    useEffect(() => {
        if (!soundUnlocked) return;
        pacientes.forEach(p => {
            if (
                (p.status === "chamado" || p.status === "em_atendimento") &&
                p.room_name?.endsWith("-online") &&
                !knownNaSalaRooms.current.has(p.room_name)
            ) {
                knownNaSalaRooms.current.add(p.room_name);
                playSound(audioNaSalaRef);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pacientes, soundUnlocked]);

    const handleChamar = async (filaId: string) => {
        try {
            const res = await fetch("/api/fila/medico", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filaId, medicoId: "doc-123" }) // Em real auth, usar auth param
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Paciente chamado! Aguarde o paciente entrar na sala...");
                fetchFila();
            }
        } catch (e) {
            toast.error("Erro ao chamar paciente.");
        }
    };

    const handleIrParaSala = async (pacienteId: string, roomName?: string) => {
        try {
            await fetch("/api/fila/status", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pacienteId, novoStatus: "em_atendimento" }),
            });
            const docName = session?.user?.name ? `${session.user.name}` : "Médico";
            window.location.href = `/teleconsulta/sala${roomName ? '?room=' + roomName + '&nome=' + encodeURIComponent(docName) + '&pacienteId=' + pacienteId + '&medico=true' : ''}`;
        } catch (e) {
            console.error("Erro ao entrar na sala:", e);
        }
    };

    const pacienteSendoChamado = pacientes.find(p => p.status === "chamado" || p.status === "em_atendimento");

    const pacientesFiltrados = pacientes.filter(p => {
        if (abaAtual === "aguardando") return p.status === "aguardando" || p.status === "chamado";
        if (abaAtual === "atendidos") return p.status === "em_atendimento" || p.status === "finalizado";
        if (abaAtual === "cancelados") return p.status === "cancelado" || p.status === "cancelado pelo usuario" || p.status === "ausente";
        return false;
    });

    return (
        <main className={`${tema.mainBg} min-h-screen`}>
            <HeaderIn paginaAtiva="telemedicina" tipoU="medico" sessionServer={session} />


            {/* Banner de liberação de áudio (iOS/Android bloqueiam sem interação) */}
            {!soundUnlocked && (
                <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm">
                        <span className="text-lg">🔔</span>
                        <span>
                            <strong>Ativar alertas sonoros</strong> — Toque aqui para receber sons quando novos pacientes entrarem na fila ou na sala.
                        </span>
                    </div>
                    <button
                        onClick={() => {
                            // Toca e pausa imediatamente para desbloquear o AudioContext no iOS/Android
                            audioAguardandoRef.current?.play().then(() => {
                                audioAguardandoRef.current?.pause();
                                audioAguardandoRef.current!.currentTime = 0;
                            }).catch(() => { });
                            audioNaSalaRef.current?.play().then(() => {
                                audioNaSalaRef.current?.pause();
                                audioNaSalaRef.current!.currentTime = 0;
                            }).catch(() => { });
                            setSoundUnlocked(true);
                            toast.success("🔊 Alertas sonoros ativados!");
                        }}
                        className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-4 rounded-lg text-sm transition"
                    >
                        Ativar Sons
                    </button>
                </div>
            )}

            <div className="p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    <header className="mb-8">
                        <div>
                                <div className="flex items-center gap-4">
                                    <h1 className={`text-3xl font-bold flex items-center gap-3 ${tema.textPrimary}`}>
                                        <FiUsers className="text-blue-600" />
                                        Gestão de Fila
                                    </h1>
                                    <button
                                        onClick={() => router.push('/paciente/arvore')}
                                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm uppercase tracking-widest"
                                    >
                                        <span className="text-lg">🌳</span>
                                        Explorador clínico
                                    </button>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 mt-1 mb-4">Acompanhe e convoque pacientes aguardando atendimento online.</p>

                            <div className="inline-flex bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow border border-gray-200 dark:border-gray-700 items-center gap-3">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {pacientes.filter(p => p.status === "aguardando" || p.status === "chamado").length} aguardando
                                </span>
                            </div>
                        </div>
                    </header>

                    {/* Abas */}
                    <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
                        {(["aguardando", "atendidos", "cancelados"] as const).map(aba => (
                            <button
                                key={aba}
                                onClick={() => setAbaAtual(aba)}
                                className={`pb-3 px-2 text-sm font-medium transition whitespace-nowrap ${abaAtual === aba
                                    ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                    }`}
                            >
                                {aba.charAt(0).toUpperCase() + aba.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* ALERTA: Paciente atualmente sendo chamado */}
                    {pacienteSendoChamado && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/40 border-l-4 border-yellow-400 p-4 md:p-6 rounded-r-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-yellow-100 dark:bg-yellow-800 rounded-full text-yellow-600 dark:text-yellow-300">
                                    <FiClock className="w-6 h-6 animate-spin-slow" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-yellow-800 dark:text-yellow-200">
                                        {pacienteSendoChamado.status === "em_atendimento" ? "Consulta em andamento" : (pacienteSendoChamado.room_name?.endsWith('-online') ? "O paciente já entrou!" : "Paciente chamado")}
                                    </h3>
                                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                        {pacienteSendoChamado.status === "em_atendimento"
                                            ? <>O paciente <strong>{pacienteSendoChamado.paciente_nome || "Paciente"}</strong> está na consulta.</>
                                            : (pacienteSendoChamado.room_name?.endsWith('-online')
                                                ? <>o paciente <strong>{pacienteSendoChamado.paciente_nome || "Paciente"}</strong> já esta na sala.</>
                                                : <>Aguardando o paciente <strong>{pacienteSendoChamado.paciente_nome || ""}</strong>. Ao entrar na sala, a contagem de 2 minutos do paciente iniciará.</>)
                                        }
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    const cleanRoom = pacienteSendoChamado.room_name?.replace('-online', '');
                                    handleIrParaSala(pacienteSendoChamado.paciente_id, cleanRoom);
                                }}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg shadow font-bold whitespace-nowrap text-center transition w-full md:w-auto"
                            >
                                Entrar na sala
                            </button>
                        </div>
                    )}

                    {!carregando && pacientesFiltrados.length === 0 ? (
                        <div className="py-16 mt-4 opacity-80 text-center text-gray-500 flex flex-col items-center justify-center">
                            <FiAlertCircle className="w-16 h-16 mb-4 text-gray-400 opacity-50" />
                            <p className="text-lg font-medium">Nenhum paciente nesta lista no momento.</p>
                        </div>
                    ) : (
                        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow border ${tema.borderColor} overflow-hidden`}>
                            <div className="overflow-x-auto w-full">
                                <table className="w-full min-w-[1000px] text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 text-sm uppercase">
                                            <th className="p-4 font-semibold whitespace-nowrap">Ordem</th>
                                            <th className="p-4 font-semibold whitespace-nowrap">Paciente</th>
                                            <th className="p-4 font-semibold whitespace-nowrap">Tempo de Espera</th>
                                            <th className="p-4 font-semibold whitespace-nowrap">Sintomas Apresentados</th>
                                            <th className="p-4 font-semibold whitespace-nowrap">Exames Anexados</th>
                                            <th className="p-4 font-semibold text-right whitespace-nowrap">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {carregando && (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-gray-500">
                                                    Carregando fila...
                                                </td>
                                            </tr>
                                        )}

                                        {/* Empty state movido para fora da tabela */}

                                        {pacientesFiltrados
                                            .map((p, index) => {
                                                const waitingMins = Math.floor((new Date().getTime() - new Date(p.data_entrada).getTime()) / 60000);
                                                const isEsperando = p.status === "aguardando" || p.status === "chamado";

                                                return (
                                                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition border-b border-gray-100 dark:border-gray-700 last:border-0">
                                                        <td className="p-4">
                                                            <span className="font-black text-2xl text-gray-300 dark:text-gray-600">
                                                                {index + 1}º
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-gray-800 dark:text-gray-200 font-medium whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-2 h-2 rounded-full ${p.status === 'finalizado' ? 'bg-blue-500' : isEsperando ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-400'}`}></span>
                                                                {p.paciente_nome || "Não informado"}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                            {waitingMins} {waitingMins === 1 ? 'minuto' : 'minutos'}
                                                        </td>
                                                        <td className="p-4 text-gray-600 dark:text-gray-400 max-w-xs truncate" title={p.sintomas || "Nenhum informado"}>
                                                            {p.sintomas ? (
                                                                <div className="flex items-center gap-2">
                                                                    <FiClipboard className="text-blue-500 flex-shrink-0" />
                                                                    <span className="truncate">{p.sintomas}</span>
                                                                </div>
                                                            ) : "Nenhum informado"}
                                                        </td>
                                                        <td className="p-4 text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={p.exames_anexados || "Nenhum exam anexado"}>
                                                            {p.exames_anexados ? (
                                                                <div className="flex items-center gap-2">
                                                                    <FiFileText className="text-emerald-500 flex-shrink-0" />
                                                                    <span className="truncate">{p.exames_anexados}</span>
                                                                </div>
                                                            ) : "Nenhum exame anexado"}
                                                        </td>
                                                        <td className="p-4 text-right whitespace-nowrap">
                                                            {p.status === "finalizado" ? (
                                                                <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm font-semibold capitalize border border-blue-200 dark:border-blue-800">
                                                                    Finalizado
                                                                </span>
                                                            ) : p.status === "aguardando" ? (
                                                                <button
                                                                    onClick={() => handleChamar(p.id)}
                                                                    disabled={!!pacienteSendoChamado}
                                                                    className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg font-medium shadow-sm transition
                                                                ${pacienteSendoChamado
                                                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700'
                                                                            : 'bg-green-600 hover:bg-green-700 text-white'}`}
                                                                >
                                                                    <FiPhoneCall /> Chamar
                                                                </button>
                                                            ) : p.status === "em_atendimento" ? (
                                                                <button
                                                                    onClick={() => {
                                                                         const docName = session?.user?.name ? `${session.user.name} (Médico)` : "Médico";
                                                                         router.push(`/teleconsulta/sala?room=${p.room_name}&nome=${encodeURIComponent(docName)}&pacienteId=${p.paciente_id}&medico=true`);
                                                                     }}
                                                                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg font-medium shadow-sm transition bg-blue-600 hover:bg-blue-700 text-white"
                                                                >
                                                                    <FiVideo /> Retornar à Sala
                                                                </button>
                                                            ) : p.status.startsWith("cancelado") || p.status === "ausente" ? (
                                                                <span className="inline-block px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm font-semibold capitalize border border-red-200 dark:border-red-800">
                                                                    {p.status.replace(/_/g, " ")}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-sm font-semibold capitalize">
                                                                    {p.status.replace(/_/g, " ")}
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main >
    );
}
