"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FiMic, FiEdit3, FiClock, FiChevronLeft, FiLogOut, FiActivity, FiCheckCircle, FiPhoneCall 
} from "react-icons/fi";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Session } from "next-auth";
import { toast, Toaster } from "react-hot-toast";

// Hooks e Componentes existentes
import { useMicrophone } from "./Microphone";
import { useAudioPlayer } from "./AudioPlayer";
import { useTheme } from "./ThemeProvider";
import FalaModal from "./FalaModal";
import DigitarSintomasModal from "./DigitarSintomasModal";
import Historico from "./Historico";
import HistoricoModal from "./HistoricoModal";
import Loader from "./Loader";
import QrCodeModal from "./QrCodeModal";
import MapaRota from "./MapaRota";
import TermoTriageModal from "./TermoTriageModal";
import GeoExplicacaoModal from "./GeoExplicacaoModal";
import AvisoMonitoradoModal from "./AvisoMonitoradoModal";
import { safeStorage } from "@/lib/storage";

interface CidadaoPortalProps {
  pacienteId: string;
  pacienteNome: string;
  sessionServer?: Session;
  isMonitored: boolean;
}

export default function CidadaoPortal({ 
  pacienteId, pacienteNome, sessionServer, isMonitored 
}: CidadaoPortalProps) {
  const router = useRouter();
  const { tema, themeName } = useTheme();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE LOGICA COMPLETA (IGUAL CLIENTAPP) ---
  const [modalAberto, setModalAberto] = useState(false); // Digitar
  const [historico, setHistorico] = useState<any[]>([]);
  const [historicoCarregado, setHistoricoCarregado] = useState(false);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  
  // Detalhes do Histórico
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [historicoSelecionado, setHistoricoSelecionado] = useState<any | null>(null);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<any | null>(null);
  const [modalEnderecoAberto, setModalEnderecoAberto] = useState(false);
  const [modalQrAberto, setModalQrAberto] = useState(false);
  const [tokenQr, setTokenQr] = useState("");

  const [relatoId, setRelatoId] = useState<string>("");
  const [textoAtual, setTextoAtual] = useState("");
  const [origemAtual, setOrigemAtual] = useState<"fala" | "digitacao" | "voz" | null>(null);
  
  // Modais de Permissão/Termos
  const [modalTermoTriageAberto, setModalTermoTriageAberto] = useState(false);
  const [modalAvisoMonitoradoAberto, setModalAvisoMonitoradoAberto] = useState(false);
  const [modalGeoAberto, setModalGeoAberto] = useState(false);
  const [consentimentoJuridicoGlobal, setConsentimentoJuridicoGlobal] = useState(false);
  const [acaoPendente, setAcaoPendente] = useState<"falar" | "digitar" | null>(null);
  const [realIsMonitored, setRealIsMonitored] = useState<boolean>(isMonitored);
  const [modoTeste, setModoTeste] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem("cliv_modo_teste") === "true";
    return false;
  });

  // Hook de Áudio
  const audioPlayer = useAudioPlayer(tema);
  
  // Hook de Microfone (Pre-Triagem)
  const microphone = useMicrophone({
    pacienteId,
    pacienteNome,
    sessionServer,
    isMonitored,
    onProcessarFim: (qrToken: string, transcricao: string) => {
      setRelatoId(qrToken);
      setTextoAtual(transcricao || "");
      setOrigemAtual("voz");
      fetchHistorico(); 
    },
    onStopAudio: audioPlayer.pararAudio,
    tocarAudioResultado: audioPlayer.tocarAudioResultado,
    tema,
    userLocation,
    isTeste: modoTeste
  });

  const {
    modalFalaAberto, setModalFalaAberto, handleClickFalarSintomas,
    processando, resultadoTriagem, etapaMensagem, limparProcessamento,
    getClassificacaoColor, origemProcessamento, finalizarFala,
    fotoPendente, setFotoPendente,
    audioPendente, setAudioPendente,
    examePendente, setExamePendente,
    salvarRegistroUnico
  } = microphone;

  // --- LOGICA DE SINCRONIZACAO ---

  const gerarQrCompleto = (historicoId: string) => {
    if (!historicoId) return;
    const payload = {
      historicoId,
      unidade: unidadeSelecionada ? { nome: unidadeSelecionada.nome, lat: unidadeSelecionada.lat, lng: unidadeSelecionada.lng } : null,
      userLocation: userLocation ? { lat: userLocation[0], lng: userLocation[1] } : null,
    };
    const uint8Array = new TextEncoder().encode(JSON.stringify(payload));
    const binString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join("");
    setTokenQr(btoa(binString));
  };

  useEffect(() => {
    if (relatoId) gerarQrCompleto(relatoId);
  }, [relatoId, unidadeSelecionada]);

  // Captura de Localização igual ClientApp
  const startWatching = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.watchPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.warn("GPS Error:", err.message),
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 30000 }
    );
  };

  useEffect(() => {
    if ("geolocation" in navigator) {
      if (!safeStorage.getItem("geoExplicacaoVisto")) setModalGeoAberto(true);
      else startWatching();
    }
  }, []);

  // Busca inicial igual ClientApp
  useEffect(() => {
    async function loadInitial() {
      await fetchUnidades();
      await fetchHistorico();
      setLoading(false);
    }
    loadInitial();
  }, [pacienteId]);

  async function fetchUnidades() {
    try {
      const res = await fetch(`/api/unidades?teste=${modoTeste}`);
      const data = await res.json();
      if (Array.isArray(data)) setUnidades(data);
    } catch (err) {}
  }

  async function fetchHistorico() {
    if (!pacienteId) return;
    try {
      const res = await fetch(`/api/historico?pacienteId=${pacienteId}&teste=${modoTeste}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistorico(data.map((h: any) => ({
          id: h.id,
          texto: h.descricao,
          classificacao: h.classificacao || "",
          status: h.status || "Iniciado",
          dataHora: new Date(h.data_cadastro).toLocaleString("pt-BR"),
          lat: h.latitude,
          lng: h.longitude,
          sintomas: h.sintomas || [],
        })));
      }
    } catch (err) {} finally { setHistoricoCarregado(true); }
  }

  // --- HANDLERS DE ABERTURA (COM TERMOS) ---
  const handleAbrirTermoTriage = (acao: "falar" | "digitar") => {
    if (!userLocation) { setAcaoPendente(acao); setModalGeoAberto(true); return; }
    if (realIsMonitored && !consentimentoJuridicoGlobal) { setAcaoPendente(acao); setModalAvisoMonitoradoAberto(true); return; }
    
    if (safeStorage.getItem("termo_triage_aceito")) {
      if (acao === "falar") handleClickFalarSintomas();
      else setModalAberto(true);
    } else {
      setAcaoPendente(acao);
      setModalTermoTriageAberto(true);
    }
  };

  const processarSintomasDigitados = (texto: string) => {
    setTextoAtual(texto);
    setOrigemAtual("digitacao");
    microphone.processarSintomas(texto, "digitacao");
  };

  // --- UI RENDER ---
  if (loading) return <Loader isDark={themeName === "dark"} />;

  return (
    <div className={`min-h-screen ${tema.mainBg} text-slate-900 dark:text-white font-sans overflow-x-hidden pb-20`}>
      <Toaster position="top-right" />
      
      {/* Header Premium */}
      <header className="px-6 pt-10 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/saudegov')}
            className={`p-3 rounded-2xl ${tema.cardBg} border ${tema.borderColor} hover:bg-blue-500 hover:text-white transition-all`}
          >
            <FiChevronLeft size={20} />
          </button>
          <div className="flex flex-col">
             <h1 className="text-xl font-black">Área do Cidadão</h1>
             <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Olá, {pacienteNome.split(' ')[0]}</p>
          </div>
        </div>
        <button 
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all"
        >
          <FiLogOut size={20} />
        </button>
      </header>

      <main className="px-6 space-y-10 max-w-2xl mx-auto mt-6">
        
        <section className="space-y-2">
           <h2 className="text-3xl font-black tracking-tight leading-tight">Escolha como relatar seus sintomas</h2>
        </section>

        {/* Botoes de Ação Premium */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           <motion.button
             whileHover={{ scale: 1.02 }}
             whileTap={{ scale: 0.98 }}
             onClick={() => handleAbrirTermoTriage("falar")}
             className="relative overflow-hidden group p-8 rounded-[32px] bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-500/20 text-left"
           >
              <div className="relative z-10">
                 <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                    <FiMic size={28} />
                 </div>
                 <h3 className="text-xl font-bold mb-2">Falar agora</h3>
                 <p className="text-xs text-white/70 leading-relaxed font-medium">Use a voz para uma triagem rápida e precisa.</p>
              </div>
              <FiMic className="absolute -right-4 -bottom-4 text-white/5 group-hover:scale-110 transition-transform" size={120} />
           </motion.button>

           <motion.button
             whileHover={{ scale: 1.02 }}
             whileTap={{ scale: 0.98 }}
             onClick={() => handleAbrirTermoTriage("digitar")}
             className={`relative overflow-hidden group p-8 rounded-[32px] ${tema.cardBg} border ${tema.borderColor} shadow-xl shadow-black/5 text-left`}
           >
              <div className="relative z-10">
                 <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6">
                    <FiEdit3 size={28} />
                 </div>
                 <h3 className="text-xl font-bold mb-2">Digitar texto</h3>
                 <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Relate detalhadamente escrevendo o que sente.</p>
              </div>
              <FiEdit3 className="absolute -right-4 -bottom-4 text-slate-900/5 dark:text-white/5 group-hover:scale-110 transition-transform" size={120} />
           </motion.button>
        </section>

        {/* Historico */}
        <section className="space-y-6">
           <div className="flex items-center justify-between border-b dark:border-white/5 pb-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                 <FiClock size={14} /> Histórico de Atendimentos
              </h3>
           </div>

           <div className={`${tema.cardBg} border ${tema.borderColor} rounded-[32px] overflow-hidden`}>
             <Historico
               historico={historico}
               loading={!historicoCarregado}
               userLocation={userLocation}
               ubs={unidades.filter((u:any) => u.tipo === "UBS")}
               upa={unidades.filter((u:any) => u.tipo === "UPA")}
               setSintomas={() => {}}
               setModalAberto={setModalAberto}
               setHistorico={setHistorico}
               setUnidadeSelecionada={setUnidadeSelecionada}
               abrirModalEndereco={() => setModalEnderecoAberto(true)}
               abrirModalQr={(id) => { setTokenQr(id); setModalQrAberto(true); }}
               abrirModalResultado={(item) => {
                 setHistoricoSelecionado(item);
                 setModalHistoricoAberto(true);
               }}
               getClassificacaoColor={getClassificacaoColor}
               tema={tema}
             />
           </div>
        </section>
      </main>

      {/* --- MODAIS DE FLUXO COMPLETO --- */}
      <FalaModal
        isOpen={modalFalaAberto}
        onClose={() => { setModalFalaAberto(false); audioPlayer.pararAudio(); limparProcessamento(); }}
        falaAtiva={microphone.falaAtiva}
        tempoRestante={microphone.tempoRestante}
        transcricao={microphone.transcricao}
        processando={processando}
        resultadoTriagem={resultadoTriagem}
        etapaMensagem={etapaMensagem}
        origemProcessamento={origemProcessamento}
        finalizarFala={finalizarFala}
        getClassificacaoColor={getClassificacaoColor}
        CircularProgress={microphone.CircularProgress}
        tema={tema}
        limparProcessamento={limparProcessamento}
        pararAudio={audioPlayer.pararAudio}
        qrToken={tokenQr}
        unidadeSelecionada={unidadeSelecionada}
        userLocation={userLocation}
        historicoId={relatoId}
        processarSintomas={microphone.processarSintomas}
        pacienteId={pacienteId}
        isMonitored={isMonitored}
        fotoPendente={fotoPendente}
        audioPendente={audioPendente}
        examePendenteState={examePendente}
        setFotoPendente={setFotoPendente}
        setAudioPendente={setAudioPendente}
        setExamePendenteState={setExamePendente}
        salvarRegistroUnico={salvarRegistroUnico}
      />

      <DigitarSintomasModal
        isOpen={modalAberto}
        onClose={() => { setModalAberto(false); limparProcessamento(); }}
        tema={tema}
        processarSintomas={microphone.processarSintomas}
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
        pacienteId={pacienteId}
        relatoId={relatoId}
        salvarRegistroUnico={salvarRegistroUnico}
      />

      {/* Outros modais administrativos */}
      <GeoExplicacaoModal
        isOpen={modalGeoAberto}
        onClose={() => setModalGeoAberto(false)}
        onPermitir={() => { safeStorage.setItem("geoExplicacaoVisto", "true"); setModalGeoAberto(false); startWatching(); }}
        tema={tema}
      />

      <TermoTriageModal
        isOpen={modalTermoTriageAberto}
        pacienteId={pacienteId}
        onAceitar={() => { setModalTermoTriageAberto(false); safeStorage.setItem("termo_triage_aceito", "true"); if (acaoPendente === "falar") handleClickFalarSintomas(); else setModalAberto(true); setAcaoPendente(null); }}
        onFechar={() => { setModalTermoTriageAberto(false); setAcaoPendente(null); }}
      />

      <AvisoMonitoradoModal
        isOpen={modalAvisoMonitoradoAberto}
        tema={tema}
        onClose={() => setModalAvisoMonitoradoAberto(false)}
        onConfirm={() => { setModalAvisoMonitoradoAberto(false); setConsentimentoJuridicoGlobal(true); startWatching(); if (acaoPendente) handleAbrirTermoTriage(acaoPendente); }}
      />

      <HistoricoModal
        isOpen={modalHistoricoAberto}
        onClose={() => setModalHistoricoAberto(false)}
        item={historicoSelecionado}
        getClassificacaoColor={getClassificacaoColor}
        tema={tema}
        unidadeSelecionada={unidadeSelecionada}
        userLocation={userLocation}
      />

      <MapaRota
        isOpen={modalEnderecoAberto}
        onClose={() => setModalEnderecoAberto(false)}
        tema={tema}
        unidadeSelecionada={unidadeSelecionada}
        userLocation={userLocation}
      />

      <QrCodeModal
        isOpen={modalQrAberto}
        onClose={() => setModalQrAberto(false)}
        token={tokenQr}
        darkMode={themeName === "dark"}
      />

    </div>
  );
}
