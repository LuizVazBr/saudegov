"use client";

import { useState, useEffect } from "react";
import { FiX, FiCheck, FiVideo } from "react-icons/fi";
import { toast } from "react-hot-toast";
import BottomSheetModal from "./BottomSheetModal";
import dynamic from "next/dynamic";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/navigation";
import TermoTelemedinaModal from "./TermoTelemedinaModal";
import { verificarStatusTelemedicina, registrarDecisaoTelemedicina, registrarAceiteCache } from "../lib/telemedicina";

// O ícone será criado de forma lazy para evitar erro de window no SSR
let L: any = null;
let iconMarker: any = null;

// Os ícones serão gerados dinamicamente dentro do componente

// Importação dinâmica dos componentes do mapa para evitar SSR
const MapContainer = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then(mod => mod.Popup), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then(mod => mod.Polyline), { ssr: false });

interface Tema {
    btnBg: string;
    btnHover: string;
    btnMap: string;
    btnHoverMap: string;
}

interface HistoricoItem {
    id?: string;
    texto: string;
    dataHora: string;
    classificacao: string;
    status?: string;
    expira?: string;
    origem?: string;
    qrToken?: string;
    sintomas?: string[];
    // Dados da fila de telemedicina
    fila_status?: string;
    fila_chamado_em?: string;
    fila_data_entrada?: string;
    fila_room_name?: string;
}

interface HistoricoModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: HistoricoItem | null;
    getClassificacaoColor: (classificacao: string) => string;
    tema: Tema;
    unidadeSelecionada?: { lat: number; lng: number; nome?: string; endereco?: string } | null;
    userLocation?: [number, number] | null;
}

export default function HistoricoModal({
    isOpen,
    onClose,
    item,
    getClassificacaoColor,
    tema,
    unidadeSelecionada,
    userLocation,
}: HistoricoModalProps) {
    const router = useRouter();
    if (!item) return null;

    // Helper para formatar data/hora no padrão brasileiro
    const formatarDataHora = (isoDate?: string) => {
        if (!isoDate) return "--";
        return new Date(isoDate).toLocaleString("pt-BR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    };

    const [medicosOnline, setMedicosOnline] = useState(true);
    useEffect(() => {
        let interval: NodeJS.Timeout;

        const checkStatus = () => {
            fetch("/api/fila/status-medicos?t=" + Date.now())
                .then(res => res.json())
                .then(data => {
                    if (typeof data.medicos_online === "boolean") setMedicosOnline(data.medicos_online);
                })
                .catch(err => console.error("Erro status medicos:", err));
        };

        if (isOpen) {
            checkStatus();
            interval = setInterval(checkStatus, 10000); // Polling a cada 10s
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isOpen]);

    const filaStatus = item.fila_status?.toLowerCase();

    // Mostra bloco de telemedicina apenas para classificações leves
    const classificacaoLeve =
        item.classificacao &&
        (item.classificacao.toLowerCase().trim() === "azul" || item.classificacao.toLowerCase().trim() === "verde");

    // Determina o estado do bloco de telemedicina
    const teleMedFinalizado = filaStatus === "finalizado";
    const teleMedCancelado = filaStatus === "cancelado" || filaStatus === "cancelado pelo usuario" || filaStatus === "ausente";
    const isElegivelTelemedicina = classificacaoLeve && !teleMedFinalizado && !teleMedCancelado;

    const isExpirado = 
        item.status?.toLowerCase() === "expirado" || 
        item.status?.toLowerCase() === "cancelado" ||
        (item.expira && new Date(item.expira) < new Date());

    const [isEntrandoFila, setIsEntrandoFila] = useState(false);
    const [termoAberto, setTermoAberto] = useState(false);
    const [termoRecusado, setTermoRecusado] = useState(false);

    // Sincroniza termoRecusado com cache e banco para persistência imediata e entre sessões
    useEffect(() => {
        const checkStatus = async () => {
            const pid = sessionStorage.getItem("pacienteId");
            if (isOpen && pid) {
                const status = await verificarStatusTelemedicina(pid);
                setTermoRecusado(!!status.recusado);
            }
        };
        checkStatus();
    }, [isOpen]);

    const handleRecusarTermo = async () => {
        setTermoRecusado(true);
        setTermoAberto(false);
        const pacienteId = sessionStorage.getItem("pacienteId");
        if (pacienteId) {
            await registrarDecisaoTelemedicina(pacienteId, "recusa");
        }
    };

    // Entra efetivamente na fila (após termo aceito ou se já aceitou antes)
    const entrarNaFilaEfetivamente = async () => {
        const pacienteId = sessionStorage.getItem("pacienteId");
        if (!pacienteId) {
            toast.error("Erro: Identificação do paciente não encontrada.");
            return;
        }
        setIsEntrandoFila(true);
        try {
            const res = await fetch("/api/fila", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pacienteId, historicoId: item?.id }),
            });
            const data = await res.json();
            if (data.success) {
                sessionStorage.setItem("pacienteIdFila", pacienteId);
                router.push("/fila-telemedicina");
            } else {
                toast.error(data.error || "Erro ao entrar na fila.");
            }
        } catch (e) {
            console.error(e);
            toast.error("Erro ao conectar com servidor.");
        } finally {
            setIsEntrandoFila(false);
        }
    };

    // Verifica se já aceitou o termo; se não, abre o modal de consentimento
    const handleEntrarFilaTelemedicina = async () => {
        const pacienteId = sessionStorage.getItem("pacienteId");
        if (!pacienteId) {
            toast.error("Erro: Identificação do paciente não encontrada.");
            return;
        }
        try {
            // 1. Verifica no banco ou cache da sessão
            const status = await verificarStatusTelemedicina(pacienteId);
            if (status.aceito) {
                // Já aceitou — entra direto na fila
                await entrarNaFilaEfetivamente();
            } else {
                // Primeira vez — abre o modal do termo (reseta recusa se o usuário clicou de novo explicitamente)
                if (status.recusado) {
                    sessionStorage.removeItem(`tele_refusal_${pacienteId}`);
                }
                setTermoRecusado(false);
                setTermoAberto(true);
            }
        } catch {
            // Em caso de erro na verificação, abre o termo por precaução
            setTermoAberto(true);
        }
    };

    const pacienteIdStr = typeof window !== "undefined" ? sessionStorage.getItem("pacienteId") || "" : "";

    // Geração segura de ícones
    const getHouseIcon = () => {
        if (typeof window === "undefined") return null;
        if (!L) L = require("leaflet");
        return L.divIcon({
            className: "house-icon",
            html: `
              <div style="width: 32px; height: 32px; background: rgba(12,14,20,0.9); border: 2px solid #0088ff; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(0,136,255,0.3);">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0088ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
        });
    };

    const getTriageIconSafe = (classificacao: string) => {
        if (typeof window === "undefined") return null;
        if (!L) L = require("leaflet");
        const color = getClassificacaoColor(classificacao).includes("bg-") ? "#3b82f6" : getClassificacaoColor(classificacao);
        return L.divIcon({
            className: "triage-icon",
            html: `<div style="width: 16px; height: 16px; background: ${color}; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px ${color}80;"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
        });
    };

    return (
        <>
        <BottomSheetModal isOpen={isOpen} onClose={onClose}>
            <div className="flex flex-col items-center w-full max-h-[70vh] overflow-y-auto space-y-6 p-4">

                <div className="relative w-full">
                    <button
                        onClick={onClose}
                        aria-label="Fechar modal"
                        className="absolute -top-6 right-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                        <FiX size={20} className="text-gray-600 dark:text-gray-300" />
                    </button>
                </div>

                <div className="w-full">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-500 mb-4">
                        Resultado da pré-triagem
                    </h2>

                    {/* Sintomas */}
                    {item.sintomas && item.sintomas.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-500 mb-2">
                                Sintomas identificados:
                            </h3>
                            <ul className="space-y-2">
                                {item.sintomas.map((s, i) => (
                                    <li key={i} className="flex items-start">
                                        <FiCheck className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                                        <span className="text-gray-700 dark:text-gray-500">{s}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Classificação */}
                    <div className="flex flex-col mb-4">
                        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-500 mb-1">
                            Classificação de risco:
                        </h3>
                        <div className="flex items-center justify-between w-full">
                            <p className="text-gray-600 dark:text-gray-400 text-sm flex-1">
                                {item.texto}
                            </p>
                            <div
                                className={`${getClassificacaoColor(item.classificacao)} text-white font-bold px-4 py-1 rounded-lg ml-2`}
                            >
                                {item.classificacao.toUpperCase()}
                            </div>
                        </div>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
                            Este é um histórico de uma avaliação anterior.
                        </p>
                    </div>

                    {/* Local / Mapa */}
                    {unidadeSelecionada && (
                        <div className="mt-6 w-full text-left">
                            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-500 mb-1">
                                Local de atendimento sugerido:
                            </h3>
                            <p className="text-gray-700 dark:text-gray-400 font-medium mb-1">
                                {unidadeSelecionada.nome}
                            </p>
                            {unidadeSelecionada.endereco && (
                                <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
                                    {unidadeSelecionada.endereco}
                                </p>
                            )}
                            
                            {userLocation ? (
                                <div className="w-full h-64 mt-2">
                                    {typeof window !== "undefined" && (
                                        <MapContainer
                                            center={[(userLocation[0] + unidadeSelecionada.lat) / 2, (userLocation[1] + unidadeSelecionada.lng) / 2]}
                                            zoom={13}
                                            style={{ height: "100%", width: "100%" }}
                                        >
                                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                            {getHouseIcon() && unidadeSelecionada.lat != null && unidadeSelecionada.lng != null && (
                                                <Marker position={[unidadeSelecionada.lat, unidadeSelecionada.lng]} icon={getHouseIcon()}>
                                                    <Popup>{unidadeSelecionada.nome}</Popup>
                                                </Marker>
                                            )}
                                            {getTriageIconSafe(item.classificacao) && userLocation && (
                                                <Marker position={userLocation} icon={getTriageIconSafe(item.classificacao)}>
                                                    <Popup>Você está aqui</Popup>
                                                </Marker>
                                            )}
                                            {userLocation && unidadeSelecionada.lat != null && unidadeSelecionada.lng != null && (
                                                <Polyline
                                                    positions={[userLocation, [unidadeSelecionada.lat, unidadeSelecionada.lng]]}
                                                    pathOptions={{ color: "blue", weight: 4 }}
                                                />
                                            )}
                                        </MapContainer>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-500 flex items-center justify-center border border-dashed border-gray-300">
                                    Localização atual não disponível para o mapa.
                                </div>
                            )}
                        </div>
                    )}

                    {/* QR Code */}
                    {item.id && (
                        <div className="mt-6 w-full">
                            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-500 mb-2 text-left">
                                QR Code para o check-in
                            </h3>
                            <div className="p-2 bg-white dark:bg-gray-800 rounded-md flex justify-center">
                                <QRCodeCanvas
                                    value={item.id}
                                    size={150}
                                    bgColor={tema.btnBg === "dark" ? "#1F2937" : "#ffffff"}
                                    fgColor={tema.btnBg === "dark" ? "#ffffff" : "#000000"}
                                />
                            </div>
                        </div>
                    )}

                    {/* Bloco Telemedicina: mostra finalizado/cancelado sempre que há dado de fila */}
                    {(teleMedFinalizado || teleMedCancelado || classificacaoLeve) && (
                        <div className={`mt-6 w-full p-4 rounded-lg border ${teleMedFinalizado
                            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                            : teleMedCancelado
                                ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                                : `${tema.btnBg} bg-opacity-10 border-gray-200 dark:border-gray-700`
                            }`}>

                            {/* --- CASO FINALIZADO --- */}
                            {teleMedFinalizado && (
                                <>
                                    <h3 className="text-lg font-bold text-green-700 dark:text-green-400 mb-1 flex items-center gap-2">
                                        <FiCheck className="w-5 h-5" /> Atendimento online realizado
                                    </h3>
                                    <p className="text-sm text-green-600 dark:text-green-300">
                                        <span className="font-semibold">Data e horário:</span> {formatarDataHora(item.fila_chamado_em || item.fila_data_entrada)}
                                    </p>
                                </>
                            )}

                            {/* --- CASO CANCELADO / NÃO COMPARECEU --- */}
                            {teleMedCancelado && (
                                <>
                                    <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-1 flex items-center gap-2">
                                        <span>❌</span> Atendimento online não realizado
                                    </h3>
                                    <p className="text-sm text-red-500 dark:text-red-300 mb-1">
                                        <span className="font-semibold">Motivo:</span>{
                                            filaStatus === "cancelado pelo usuario"
                                                ? " Cancelado pelo paciente."
                                                : " Paciente não compareceu nos 2 minutos de tolerância."
                                        }
                                    </p>
                                    <p className="text-sm text-red-500 dark:text-red-300">
                                        <span className="font-semibold">Data e horário:</span> {formatarDataHora(item.fila_chamado_em || item.fila_data_entrada)}
                                    </p>
                                </>
                            )}

                            {/* --- CASO DISPONÍVEL / AGUARDANDO --- */}
                            {isElegivelTelemedicina && (
                                <>
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
                                        Atendimento online disponível
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                        Para sua comodidade, você pode entrar na fila de atendimento agora mesmo via telemedicina.
                                    </p>
                                    {!medicosOnline || isExpirado ? (
                                        <div className="relative group w-full">
                                            <button
                                                disabled
                                                className={`w-full flex justify-center items-center py-3 px-4 rounded-md shadow-sm text-gray-500 font-medium bg-gray-300 dark:bg-gray-700 cursor-not-allowed`}
                                            >
                                                <FiVideo className="w-5 h-5 mr-1" />
                                                Indisponível no momento
                                                <span className="ml-1 bg-gray-400 dark:bg-gray-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold">?</span>
                                            </button>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-[18rem] p-3 bg-gray-900 border border-gray-700 text-white text-xs text-center rounded-lg shadow-xl z-[60]">
                                                {isExpirado 
                                                  ? "Esta solicitação individual para telemedicina expirou. Por favor, realize uma nova triagem se os sintomas persistirem."
                                                  : "Não há médicos online na gestão da fila neste momento. Tente novamente posteriormente ou dirija-se presencialmente a unidade."
                                                }
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleEntrarFilaTelemedicina}
                                            disabled={isEntrandoFila} // Removido isExpirado daqui pois já cai no bloco de cima
                                            className={`w-full flex justify-center items-center py-3 px-4 rounded-md shadow-sm text-white font-medium ${tema.btnBg} ${tema.btnHover} focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            {isEntrandoFila ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Entrando na fila...
                                                </>
                                            ) : (
                                                <>
                                                    <FiVideo className="w-5 h-5 mr-2" />
                                                    Entre na fila
                                                </>
                                            )}
                                        </button>
                                    )}
                                    
                                    {isExpirado && (
                                        <p className="mt-3 text-center text-red-500 dark:text-red-400 font-medium text-sm">
                                            Esta solicitação expirou.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <button
                    onClick={onClose}
                    className={`w-full ${tema.btnBg} ${tema.btnHover} text-white font-semibold py-3 rounded-md transition`}
                >
                    Fechar
                </button>
            </div>
        </BottomSheetModal>
        {termoAberto && (
            <TermoTelemedinaModal
                isOpen={termoAberto}
                pacienteId={sessionStorage.getItem("pacienteId") || ""}
                onAceitar={async () => {
                    const pid = sessionStorage.getItem("pacienteId");
                    setTermoAberto(false);
                    setTermoRecusado(false);
                    if (pid) {
                        await registrarDecisaoTelemedicina(pid, "aceite");
                    }
                    await entrarNaFilaEfetivamente();
                }}
                onFechar={handleRecusarTermo}
            />
        )}
        </>
    );
}
