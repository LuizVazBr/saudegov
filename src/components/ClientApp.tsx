"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { FiActivity, FiHeart, FiVideo, FiAlertCircle } from "react-icons/fi";
import { Toaster } from "react-hot-toast";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

import Header from "./Header";
import Loader from "./Loader";
import QrCodeModal from "./QrCodeModal";
import DigitarSintomasModal from "../components/DigitarSintomasModal";
import InstrucoesModal from "../components/InstrucoesModal";
import FalaModal from "../components/FalaModal";
import Historico from "../components/Historico";
import HistoricoModal from "../components/HistoricoModal";

import GeoExplicacaoModal from "../components/GeoExplicacaoModal";
import UnidadesCarousel from "../components/UnidadesCarousel";
import VideoModal from "../components/VideoModal";
import GlobalFilaListener from "../components/GlobalFilaListener";
import TermoTriageModal from "../components/TermoTriageModal";
import AvisoMonitoradoModal from "../components/AvisoMonitoradoModal";

import { useMicrophone } from "../components/Microphone";
import { useTheme } from "../components/ThemeProvider";
import { useAudioPlayer } from "../components/AudioPlayer";
import { getDeviceInfo } from "@/lib/deviceDetection";
import { safeStorage } from "@/lib/storage";

import useRegisterSW from "@/hooks/useRegisterSW";

const MapaRota = dynamic(() => import("../components/MapaRota"), { ssr: false });

interface ClientAppProps {
  pacienteId: string;
  pacienteNome: string;
  sessionServer?: Session;
  isMonitored: boolean;
}

interface Unidade {
  id: string;
  nome: string;
  tipo: "UBS" | "UPA";
  endereco: string;
  telefone?: string;
  whatsapp?: string;
  lat: number;
  lng: number;
  videoUrl?: string; // opcional
  imgUrl?: string;   // opcional
  audioUrl?: string; // opcional
  distanciaKm?: string | null; // opcional
}

export default function ClientApp({ pacienteId, pacienteNome, sessionServer, isMonitored }: ClientAppProps) {

  const { data: session, status, update } = useSession({
    required: false, // não força redirect no cliente
  });

  useRegisterSW(status, (status === "authenticated" && pacienteId) ? (pacienteId as string) : "");

  const [abaAtiva, setAbaAtiva] = useState("historico");
  const [modalAberto, setModalAberto] = useState(false);
  const [sintomas, setSintomas] = useState("");
  const [modalLigacaoAberto, setModalLigacaoAberto] = useState(false);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<Unidade | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [historicoSelecionado, setHistoricoSelecionado] = useState<any | null>(null);
  const [textoAtual, setTextoAtual] = useState("");
  const [origemAtual, setOrigemAtual] = useState<"fala" | "digitacao" | "voz" | null>(null);
  const [modalEnderecoAberto, setModalEnderecoAberto] = useState(false);
  const [modalQrAberto, setModalQrAberto] = useState(false);
  const [tokenQr, setTokenQr] = useState("");
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [userUF, setUserUF] = useState<string>(""); // Novo estado para UF

  const [modalVideoAberto, setModalVideoAberto] = useState(false);
  const [videoUrlAtual, setVideoUrlAtual] = useState("");
  const [tituloVideoAtual, setTituloVideoAtual] = useState("");
  const { tema, themeName } = useTheme();

  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [activeCall, setActiveCall] = useState<{ roomName?: string; status: string; tempoEstimado?: number; posicao?: number } | null>(null);

  const tipoUsuarioRaw = sessionServer?.user?.tipo_usuario || session?.user?.tipo_usuario || "paciente";
  const isMedico = tipoUsuarioRaw.toLowerCase() === "medico";

  const [relatoId, setRelatoId] = useState<string>("");

  // Estados para Termo de Triagem
  const [modalTermoTriageAberto, setModalTermoTriageAberto] = useState(false);
  const [modalAvisoMonitoradoAberto, setModalAvisoMonitoradoAberto] = useState(false);
  const [consentimentoJuridicoGlobal, setConsentimentoJuridicoGlobal] = useState(false);
  const [acaoPendente, setAcaoPendente] = useState<"falar" | "digitar" | null>(null);
  const [realIsMonitored, setRealIsMonitored] = useState<boolean>(isMonitored);
  const [modoTeste, setModoTeste] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("cliv_modo_teste") === "true";
    }
    return false;
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'cliv_modo_teste') {
        const val = e.newValue === 'true';
        setModoTeste(val);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // ⚡ Sincronização de Carregamento Único (UI Premium)
  const [historicoCarregado, setHistoricoCarregado] = useState(false);
  const [unidadesCarregadas, setUnidadesCarregadas] = useState(false);
  const isDataReady = (unidadesCarregadas && historicoCarregado) || status === "unauthenticated";

  // ⚡ Verificação de Monitoramento em Tempo Real (Bypassa cache de sessão JWT)
  useEffect(() => {
    if (pacienteId) {
      fetch(`/api/paciente/monitored-status?id=${pacienteId}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          if (typeof data.isMonitored === 'boolean') {
            setRealIsMonitored(data.isMonitored);
          }
        })
        .catch(e => console.warn("Erro ao checar status de monitoramento:", e));
    }
  }, [pacienteId]);

  // Tracking de Dispositivo
  useEffect(() => {
    if (status === "authenticated" && pacienteId) {
      const info = getDeviceInfo();
      fetch("/api/user/device", {
        method: "POST",
      }).catch((err) => console.warn("Erro ao rastrear dispositivo:", err));
    }
  }, [status, pacienteId]);

  // Atualiza sessão quando autenticado
  useEffect(() => {
    if (status === "authenticated" && !sessionLoaded) {
      update().then(() => setSessionLoaded(true));
    }
  }, [status, update, sessionLoaded]);

  useEffect(() => {
    if (pacienteId) {
      safeStorage.setItem("pacienteId", pacienteId, "session");
      
      // Verifica se já aceitou o termo de triagem no banco
      const checkTriageConsent = async () => {
        try {
          const res = await fetch(`/api/termos-aceite?pacienteId=${pacienteId}&tipo=triage_ai`);
          const data = await res.json();
          if (data.aceito) {
            safeStorage.setItem("termo_triage_aceito", "true");
          }
        } catch (e) {
          console.warn("Erro ao verificar termo de triagem:", e);
        }
      };
      checkTriageConsent();
    }
  }, [pacienteId]);

  // --- Callback para gerar QR token completo ---
  const gerarQrCompleto = (historicoId: string) => {
    // ⚡ Correção: Não trava mais em "Gerando..." caso a unidade não tenha sido calculada
    if (!historicoId) return;

    const payload = {
      historicoId,
      unidade: unidadeSelecionada ? {
        nome: unidadeSelecionada.nome,
        lat: unidadeSelecionada.lat,
        lng: unidadeSelecionada.lng,
      } : null,
      userLocation: userLocation ? { lat: userLocation[0], lng: userLocation[1] } : null,
    };

    // ⚡ Correção para btoa com Unicode (UTF-8) para evitar crash com acentos
    const jsonStr = JSON.stringify(payload);
    const uint8Array = new TextEncoder().encode(jsonStr);
    const binString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join("");
    const token = btoa(binString);
    setTokenQr(token);
  };

  const audioPlayer = useAudioPlayer(tema);

  const microphone = useMicrophone({
    pacienteId: pacienteId || "",
    pacienteNome,
    sessionServer,
    isMonitored,
    onProcessarFim: (qrToken: string, transcricao: string) => {
      // ⚡ Apenas seta o ID, o useEffect cuidará de gerar o QR completo assim que a unidade for definida
      setRelatoId(qrToken);
      setTextoAtual(transcricao || "");
      setOrigemAtual("voz");
    },
    onStopAudio: audioPlayer.pararAudio,
    tocarAudioResultado: audioPlayer.tocarAudioResultado,
    userLocation,
    tema,
    isTeste: modoTeste,
  });

  const {
    modalFalaAberto, modalInstrucoesAberto, falaAtiva, tempoRestante, transcricao,
    processando, resultadoTriagem, setResultadoTriagem, setModalFalaAberto,
    setModalInstrucoesAberto, handleClickFalarSintomas, comecarAFalar, finalizarFala,
    CircularProgress, getClassificacaoColor, pararAudio,
    etapaMensagem, processarSintomas, origemProcessamento, limparProcessamento,
    fotoPendente, audioPendente, examePendente,
    setFotoPendente, setAudioPendente, setExamePendente,
    salvarRegistroUnico
  } = microphone;

  const {
    audioHabilitado, toggleAudio, isPlaying, togglePlay, tocarInstrucoes, pararAudio: pararAudioPlayer,
    currentUrl // Adicionado
  } = audioPlayer;

  const sentRef = useRef(false);

  // Captura localização do usuário
  const [modalGeoAberto, setModalGeoAberto] = useState(false);

  // Função unificada para iniciar geolocalização de forma robusta e SIMPLES
  const startWatching = () => {
    if (!("geolocation" in navigator)) return;

    const handleSuccess = (position: GeolocationPosition) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setUserLocation([lat, lng]);

      // Busca UF em background
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(res => res.json())
        .then(data => {
          const uf = data.address?.state || "";
          if (uf) setUserUF(uf);
        })
        .catch(e => console.warn("Erro reverse geo:", e));
    };

    const handleError = (error: GeolocationPositionError) => {
      console.warn("Erro GPS:", error.message);
    };

    // ⚡ MODIFICAÇÃO CRÍTICA:
    // Removemos a tentativa de 'Alta Precisão' que estava causando timeout.
    // Usamos watchPosition direto com 'enableHighAccuracy: false'.
    navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 30000 }
    );
  };

  useEffect(() => {
    if ("geolocation" in navigator) {
      const primeiraVez = !safeStorage.getItem("geoExplicacaoVisto");
      
      if (primeiraVez) {
        setModalGeoAberto(true);
      } else {
        // Tenta buscar se já tiver permissão anterior, mas sem bloquear/gerar erro imediato
        startWatching();
      }
    }
  }, []);

  // Buscar Status Telemedicina Ativa + Notificações unificadas
  useEffect(() => {
    let intervalo: NodeJS.Timeout;
    let jaNotificouChamado = false;

    // Pedir permissão push notification uma única vez
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    async function checkActiveCall() {
      try {
        if (isMedico) {
          const res = await fetch(`/api/fila/medico`, { cache: "no-store" });
          if (!res.ok) return;
          const data = await res.json();
          const chamando = data.find((p: any) => p.status === "chamado" || p.status === "em_atendimento");
          if (chamando) {
            setActiveCall({ roomName: chamando.room_name, status: chamando.status });
          } else {
            setActiveCall(null);
          }
        } else {
          if (!pacienteId) return;
          const res = await fetch(`/api/fila/status?pacienteId=${pacienteId}`, { 
            cache: "no-store",
            signal: AbortSignal.timeout(4000)
          });
          
          if (res.status === 502) {
             console.warn("[ClientApp] Proxy 502. Aguardando...");
             return;
          }

          if (!res.ok) return;

          const data = await res.json();
          if (data.status === "chamado" || data.status === "em_atendimento" || data.status === "aguardando") {
            setActiveCall({ roomName: data.roomName, status: data.status, posicao: data.posicao, tempoEstimado: data.tempoEstimadoMinutos });

            if (data.status === "chamado" && !jaNotificouChamado) {
              jaNotificouChamado = true;
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Sua Consulta Chegou!", {
                  body: "O médico está te esperando para a consulta online."
                });
              }
            }
          } else {
            setActiveCall(null);
            jaNotificouChamado = false;
          }
        }
      } catch (err) {
        // Silencia erros transient
      }
    }

    checkActiveCall();
    intervalo = setInterval(checkActiveCall, 8000); 
    return () => clearInterval(intervalo);
  }, [pacienteId, sessionServer, session]);

  // Buscar unidades da API
  useEffect(() => {
    async function fetchUnidades() {
      try {
        const res = await fetch(`/api/unidades?teste=${modoTeste}&refresh=true&v=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
          }
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setUnidades(data);
        } else {
          console.error("Unidades data is not an array:", data);
        }
        setUnidadesCarregadas(true);
      } catch (err) {
        console.error("Erro ao buscar unidades:", err);
        setUnidadesCarregadas(true); // evita trava
      }
    }
    fetchUnidades();
  }, [modoTeste]);

  // Histórico do paciente
  useEffect(() => {
    async function fetchHistorico() {
      if (!pacienteId) return;
      try {
        const res = await fetch(`/api/historico?pacienteId=${pacienteId}&teste=${modoTeste}&v=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
          }
        });
        const data = await res.json();
        if (!Array.isArray(data)) return;

        const historicoApi = data.map((h: any) => ({
          id: h.id,
          texto: h.descricao,
          classificacao: h.classificacao || "",
          status: h.status || "Iniciado",
          expira: "",
          origem: "banco",
          dataHora: new Date(h.data_cadastro).toLocaleString("pt-BR", { 
            day: "2-digit", 
            month: "2-digit", 
            year: "numeric", 
            hour: "2-digit", 
            minute: "2-digit" 
          }),
          lat: h.latitude,
          lng: h.longitude,
          sintomas: h.sintomas || [],
        }));
        setHistorico(historicoApi);
      } catch (err) {
        console.error("Erro ao carregar histórico:", err);
      } finally {
        setHistoricoCarregado(true);
      }
    }
    if (pacienteId) fetchHistorico();
    else setHistoricoCarregado(true);
  }, [pacienteId]);

  // ⚡ GERAÇÃO DO QR CODE COMPLETO (Sincronizado)
  useEffect(() => {
    if (relatoId) {
        // Gera o QR mesmo sem unidade inicialmente, para evitar o "Gerando..." infinito
        gerarQrCompleto(relatoId);
    }
  }, [relatoId, unidadeSelecionada]); // Re-gera se a unidade mudar/chegar

  // Atualiza histórico e QR quando triagem finalizada
  useEffect(() => {
    const temPerguntas = resultadoTriagem?.perguntas && resultadoTriagem.perguntas.length > 0;
    if (!resultadoTriagem?.classificacao || !textoAtual || !origemAtual || temPerguntas) return;

    const lat = "lat" in resultadoTriagem ? resultadoTriagem.lat : undefined;
    const lng = "lng" in resultadoTriagem ? resultadoTriagem.lng : undefined;

    const novoHistorico = {
      texto: textoAtual,
      classificacao: resultadoTriagem.classificacao,
      expira: resultadoTriagem.expira || "",
      status: "Iniciado",
      origem: origemAtual,
      dataHora: new Date().toLocaleString("pt-BR", { 
        day: "2-digit", 
        month: "2-digit", 
        year: "numeric", 
        hour: "2-digit", 
        minute: "2-digit" 
      }),
      lat,
      lng,
      id: relatoId || "",
      qrToken: tokenQr || "",
    };

    setHistorico(h => [novoHistorico, ...h]);
    setTextoAtual("");
    setOrigemAtual(null);
  }, [resultadoTriagem, tokenQr, textoAtual, origemAtual, relatoId]);

  const distancia = (a: [number, number], b: [number, number]) => {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Atualiza unidade mais próxima automaticamente
  useEffect(() => {
    if (!resultadoTriagem || unidades.length === 0) return;

    const cls = resultadoTriagem.classificacao.toLowerCase();

    const listaUnidades = unidades.filter(u =>
      (cls === "azul" || cls === "verde") ? u.tipo === "UBS" : u.tipo === "UPA"
    );

    if (listaUnidades.length === 0) return;

    if (userLocation) {
      const unidadeMaisProxima = listaUnidades.reduce((prev, curr) => {
        const distPrev = distancia([prev.lat, prev.lng], userLocation);
        const distCurr = distancia([curr.lat, curr.lng], userLocation);
        return distCurr < distPrev ? curr : prev;
      }, listaUnidades[0]);

      setUnidadeSelecionada(unidadeMaisProxima);

      // ⚡ Se o usuário permitiu localização enquanto tinha uma ação pendente, continuamos o fluxo
      if (acaoPendente) {
        handleAbrirTermoTriage(acaoPendente);
      }
    } else {
      // Fallback: se não tiver geolocalização, seleciona a primeira da lista correspondente
      setUnidadeSelecionada(listaUnidades[0]);
    }
  }, [userLocation, resultadoTriagem, unidades]);

  async function abrirModalQr(id: string, unidade?: Unidade) {
    setTokenQr(id);
    if (unidade) setUnidadeSelecionada(unidade);
    setModalQrAberto(true);
  }

  const processarSintomasDigitados = (texto: string) => {
    setTextoAtual(texto);
    setOrigemAtual("digitacao");
    processarSintomas(texto, "digitacao");
  };

  const finalizarFalaComHistorico = () => {
    setTextoAtual(transcricao || "");
    setOrigemAtual("fala");
    finalizarFala();
  };

  const handleAbrirTermoTriage = (acao: "falar" | "digitar") => {
    // ⚡ Prioridade 0: Verificação de Localização (Obrigatória conforme pedido do usuário)
    if (!userLocation) {
      setAcaoPendente(acao);
      setModalGeoAberto(true);
      return;
    }

    // ⚡ Prioridade 1: Aviso de Monitoramento (Baseado no status real do banco)
    if (realIsMonitored && !consentimentoJuridicoGlobal) {
      setAcaoPendente(acao);
      setModalAvisoMonitoradoAberto(true);
      return;
    }

    const jaAceitou = safeStorage.getItem("termo_triage_aceito");
    if (jaAceitou) {
      if (acao === "falar") handleClickFalarSintomas();
      else setModalAberto(true);
    } else {
      setAcaoPendente(acao);
      setModalTermoTriageAberto(true);
    }
  };

  const handleAceitarTermoTriage = () => {
    setModalTermoTriageAberto(false);
    if (acaoPendente === "falar") handleClickFalarSintomas();
    else if (acaoPendente === "digitar") setModalAberto(true);
    setAcaoPendente(null);
  };

  // Carregamento inicial via ClientWrapper já cuida do splash screen com logo.
  // Como o page.tsx já verificou a sessão no servidor, podemos renderizar o ClientApp diretamente
  // enquanto o useSession hidrata em background.

  if (!isDataReady) {
    return <Loader isDark={themeName === "dark"} />;
  }

  return (
    <main className={`${tema.mainBg} min-h-screen flex justify-center md:justify-start py-0 transition-colors duration-300`} suppressHydrationWarning>
      <div className={`w-full min-h-screen relative font-sans md:px-10 max-w-[380px] md:max-w-none ${tema.cardBg} border-x ${tema.borderColor}`} suppressHydrationWarning>
        

        <div className="bg-inherit border-b border-inherit">
          <Header
            handleClickFalarSintomas={() => handleAbrirTermoTriage("falar")}
            setModalAberto={(open) => {
              if (open) handleAbrirTermoTriage("digitar");
              else setModalAberto(false);
            }}
            setModalLigacaoAberto={setModalLigacaoAberto}
            modalLigacaoAberto={modalLigacaoAberto}
            handleReceberLigacao={() => setModalLigacaoAberto(false)}
            sessionServer={sessionServer}
            activeCall={activeCall}
          />
        </div>

        {/* Sempre mostrar unidades, com ou sem geolocalização */}
        <UnidadesCarousel
          unidades={unidades.map(u => ({
            ...u,
            distanciaKm: userLocation
              ? (distancia(userLocation, [u.lat, u.lng]) * 111).toFixed(1) // 1 grau ≈ 111 km
              : null
          }))}
          tema={tema}
          onSelect={(unidade) => {
            setUnidadeSelecionada(unidade);
            setModalEnderecoAberto(true);
          }}
          onWatchVideo={(unidade) => {
            if (unidade.videoUrl) {
              setVideoUrlAtual(unidade.videoUrl);
              setTituloVideoAtual(unidade.nome);
              setModalVideoAberto(true);
            }
          }}
          onPlayAudio={(unidade) => {
            // Cancela vozes sintéticas anteriores
            window.speechSynthesis.cancel();

            if (unidade.audioUrl) {
              audioPlayer.tocarAudio(unidade.audioUrl);
            }
          }}
        />

        <div className={`px-5 border-b ${tema.borderColor} ${tema.cardBg} flex space-x-6 mt-5`}>
          <button onClick={() => setAbaAtiva("historico")} className={`py-4 text-lg font-medium ${abaAtiva === "historico" ? tema.tabActive : tema.tabInactive}`}>
            Histórico
          </button>
        </div>

        {abaAtiva === "historico" && (
          <Historico
            historico={historico}
            loading={false}
            userLocation={userLocation}
            ubs={unidades.filter(u => u.tipo === "UBS")}
            upa={unidades.filter(u => u.tipo === "UPA")}
            setSintomas={setSintomas}
            setModalAberto={setModalAberto}
            setHistorico={setHistorico}
            setUnidadeSelecionada={setUnidadeSelecionada as unknown as (unidade: any) => void}
            abrirModalEndereco={() => setModalEnderecoAberto(true)}
            abrirModalQr={abrirModalQr}
            abrirModalResultado={(item) => {
              setHistoricoSelecionado(item);
              setModalHistoricoAberto(true);
            }}
            getClassificacaoColor={getClassificacaoColor}
            tema={tema}
          />

        )}

        <HistoricoModal
          isOpen={modalHistoricoAberto}
          onClose={() => setModalHistoricoAberto(false)}
          item={historicoSelecionado}
          getClassificacaoColor={getClassificacaoColor}
          tema={tema}
          unidadeSelecionada={unidadeSelecionada}
          userLocation={userLocation}
        />

        <DigitarSintomasModal
          isOpen={modalAberto}
          onClose={() => { setModalAberto(false); limparProcessamento(); }}
          tema={tema}
          processarSintomas={processarSintomas}
          processarSintomasDigitados={processarSintomasDigitados}
          isMonitored={isMonitored}
          etapaMensagem={etapaMensagem}
          processando={processando}
          resultadoTriagem={resultadoTriagem}
          getClassificacaoColor={getClassificacaoColor}
          limparProcessamento={limparProcessamento}
          qrToken={tokenQr}
          unidadeSelecionada={unidadeSelecionada}
          userLocation={userLocation}
          pacienteId={pacienteId || ""}
          relatoId={relatoId}
          salvarRegistroUnico={salvarRegistroUnico}
        />

        <InstrucoesModal
          isOpen={modalInstrucoesAberto}
          onClose={() => setModalInstrucoesAberto(false)}
          comecarAFalar={comecarAFalar}
          tocarInstrucoes={tocarInstrucoes}
          tema={tema}
        />

        <GeoExplicacaoModal
          isOpen={modalGeoAberto}
          onClose={() => setModalGeoAberto(false)}
          onPermitir={() => {
            safeStorage.setItem("geoExplicacaoVisto", "true");
            setModalGeoAberto(false);
            startWatching();
          }}
          tema={tema}
        />

        <FalaModal
          isOpen={modalFalaAberto}
          onClose={() => { setModalFalaAberto(false); pararAudioPlayer(); limparProcessamento(); }}
          falaAtiva={falaAtiva}
          tempoRestante={tempoRestante}
          transcricao={transcricao}
          processando={processando}
          resultadoTriagem={resultadoTriagem}
          etapaMensagem={etapaMensagem}
          origemProcessamento={origemProcessamento}
          finalizarFala={finalizarFalaComHistorico}
          getClassificacaoColor={getClassificacaoColor}
          CircularProgress={CircularProgress}
          tema={tema}
          limparProcessamento={limparProcessamento}
          pararAudio={pararAudioPlayer}
          qrToken={tokenQr}
          unidadeSelecionada={unidadeSelecionada}
          userLocation={userLocation}
          historicoId={relatoId}
          processarSintomas={processarSintomas}
          pacienteId={pacienteId || ""}
          isMonitored={isMonitored}
          fotoPendente={fotoPendente}
          audioPendente={audioPendente}
          examePendenteState={examePendente}
          setFotoPendente={setFotoPendente}
          setAudioPendente={setAudioPendente}
          setExamePendenteState={setExamePendente}
          salvarRegistroUnico={salvarRegistroUnico}
        />

        <TermoTriageModal
          isOpen={modalTermoTriageAberto}
          pacienteId={pacienteId || ""}
          onAceitar={handleAceitarTermoTriage}
          onFechar={() => {
            setModalTermoTriageAberto(false);
            setAcaoPendente(null);
          }}
        />

        <MapaRota
          isOpen={modalEnderecoAberto}
          onClose={() => setModalEnderecoAberto(false)}
          tema={tema}
          unidadeSelecionada={unidadeSelecionada}
          userLocation={userLocation}
        />

        <VideoModal
          isOpen={modalVideoAberto}
          onClose={() => setModalVideoAberto(false)}
          videoUrl={videoUrlAtual}
          titulo={tituloVideoAtual}
          tema={tema}
        />

        <QrCodeModal
          isOpen={modalQrAberto}
          onClose={() => setModalQrAberto(false)}
          token={tokenQr}
          darkMode={themeName === "dark"}
        />

        <AvisoMonitoradoModal
          isOpen={modalAvisoMonitoradoAberto}
          tema={tema}
          onClose={() => setModalAvisoMonitoradoAberto(false)}
          onConfirm={() => {
            setModalAvisoMonitoradoAberto(false);
            setConsentimentoJuridicoGlobal(true);
            
            // ⚡ Forçar solicitação de localização aqui (interação do usuário)
            startWatching();
            
            // ⚡ Correção do Duplo Clique: Procede diretamente para a próxima etapa 
            if (acaoPendente) {
              const acao = acaoPendente;
              setAcaoPendente(null);
              
              const jaAceitou = safeStorage.getItem("termo_triage_aceito");
              if (jaAceitou) {
                if (acao === "falar") microphone.handleClickFalarSintomas();
                else setModalAberto(true);
              } else {
                setModalTermoTriageAberto(true);
              }
            }
          }}
        />

        <Toaster
          position="top-right"
          toastOptions={{
            style: { borderRadius: '8px', background: tema.toastBg, color: tema.toastText },
          }}
        />
      </div>
    </main>
  );
}
