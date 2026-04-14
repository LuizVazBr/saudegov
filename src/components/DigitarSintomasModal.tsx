"use client";

import { useState, useRef, useEffect } from "react";
import { 
  FiSend, FiX, FiCheck, FiCamera, FiAlertCircle, 
  FiVolume2, FiVolumeX, FiAlertTriangle, FiFile, FiVideo
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import BottomSheetModal from "./BottomSheetModal";
import AgendamentoModal from "./AgendamentoModal";
import CustomSlider from "./CustomSlider";
import { QRCodeCanvas } from "qrcode.react";
import dynamic from "next/dynamic";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { useAudioPlayer } from "./AudioPlayer";
import { useRouter } from "next/navigation";
import { 
  verificarStatusTelemedicina, 
  registrarDecisaoTelemedicina 
} from "../lib/telemedicina";
import TermoTelemedinaModal from "./TermoTelemedinaModal";
import { safeStorage } from "@/lib/storage";

const MapaRota = dynamic(() => import("./MapaRota"), { ssr: false });

const iconMarker = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface Sintoma {
  nome: string;
  intensidade?: string;
}

interface ResultadoTriagem {
  sintomas: Sintoma[];
  descricao: string;
  classificacao: string;
  expira?: string;
  lat?: number;
  lng?: number;
  checkinUrl?: string;
  unidadeNome?: string;
  unidadeEndereco?: string;
  perguntas?: any[];
  acoes?: string[];
  risco_cirurgico?: boolean;
  especialidade?: string;
  sugerir_telemedicina?: boolean;
}

interface DigitarSintomasModalProps {
  isOpen: boolean;
  onClose: () => void;
  processarSintomas: (texto: string, origem: 'voz' | 'digitacao', reavaliando?: boolean) => void;
  processarSintomasDigitados: (texto: string) => void;
  processando: boolean;
  resultadoTriagem: ResultadoTriagem | null;
  etapaMensagem: string;
  isMonitored: boolean;
  pacienteId: string;
  tema: any;
  qrToken?: string | null;
  unidadeSelecionada?: any;
  userLocation?: [number, number] | null;
  limparProcessamento: () => void;
  getClassificacaoColor: (classificacao: string) => string;
  relatoId?: string | null;
  salvarRegistroUnico: (currentResultado?: any | null, forceOrigem?: 'voz' | 'digitacao' | null, forceTempo?: number | null) => Promise<void>;
}

export default function DigitarSintomasModal({
  isOpen,
  onClose,
  processarSintomas,
  processarSintomasDigitados,
  processando,
  resultadoTriagem,
  etapaMensagem,
  isMonitored,
  pacienteId,
  tema,
  qrToken,
  unidadeSelecionada,
  userLocation,
  limparProcessamento,
  getClassificacaoColor,
  relatoId,
  salvarRegistroUnico,
}: DigitarSintomasModalProps) {
  const [texto, setTexto] = useState("");
  const [isMonitoredLocal, setIsMonitoredLocal] = useState(isMonitored);
  const [consentimentoJuridico, setConsentimentoJuridico] = useState(false);
  const [respostas, setRespostas] = useState<{ [key: number]: string }>({});
  const [perguntasFeverManual, setPerguntasFeverManual] = useState<{ [key: number]: boolean }>({});
  const [valoresSintomas, setValoresSintomas] = useState<{ [key: string]: string }>({});
  const [perguntasResolvidas, setPerguntasResolvidas] = useState(false);
  const [enviandoRespostas, setEnviandoRespostas] = useState(false);
  const [isAgendamentoOpen, setIsAgendamentoOpen] = useState(false);
  const [medicosOnline, setMedicosOnline] = useState(true);
  const [hasActiveAppointment, setHasActiveAppointment] = useState(false);
  const [termoAberto, setTermoAberto] = useState(false);
  const [termoRecusado, setTermoRecusado] = useState(false);
  const router = useRouter();
  const USE_TELEMEDICINE_QUEUE = true;
  
  const { tocarAudioResultado, pararAudio, audioHabilitado, toggleAudio } = useAudioPlayer(tema);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIsMonitoredLocal(isMonitored);
  }, [isMonitored]);

  useEffect(() => {
    if (isOpen && !resultadoTriagem) {
      setRespostas({});
      setPerguntasResolvidas(false);
      setTexto("");
      setConsentimentoJuridico(false);
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [isOpen, resultadoTriagem]);

  // Sincroniza status de médicos online
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
        interval = setInterval(checkStatus, 10000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isOpen]);

  // Sincroniza termoRecusado
  useEffect(() => {
    const checkStatus = async () => {
      if (isOpen && pacienteId) {
        const status = await verificarStatusTelemedicina(pacienteId);
        setTermoRecusado(!!status.recusado);
      }
    };
    checkStatus();
  }, [isOpen, pacienteId]);

  // Check for active appointments
  useEffect(() => {
    const checkActiveAppointment = async () => {
      if (!pacienteId) return;
      try {
        const res = await fetch(`/api/agendamentos?paciente_id=${pacienteId}`);
        const appointments = await res.json();
        setHasActiveAppointment(Array.isArray(appointments) && appointments.length > 0);
      } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
      }
    };
    if (isOpen) checkActiveAppointment();
  }, [isOpen, pacienteId, isAgendamentoOpen]);

  const handleRecusarTermo = async () => {
    setTermoRecusado(true);
    setTermoAberto(false);
    if (pacienteId) await registrarDecisaoTelemedicina(pacienteId, "recusa");
  };

  const entrarNaFilaEfetivamente = async () => {
    if (!pacienteId) return;
    const toastId = toast.loading("Entrando na fila...");
    try {
      const res = await fetch("/api/fila", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pacienteId }),
      });
      const data = await res.json();
      toast.dismiss(toastId);
      if (data.success) {
        onClose();
        sessionStorage.setItem("pacienteIdFila", pacienteId);
        router.push("/fila-telemedicina");
      } else {
        toast.error("Erro ao entrar na fila.");
      }
    } catch (e) {
      toast.dismiss(toastId);
      toast.error("Erro ao conectar com servidor.");
    }
  };

  const handleEntrarFila = async () => {
    if (!pacienteId) return;
    try {
      const status = await verificarStatusTelemedicina(pacienteId);
      if (status.aceito) {
        await entrarNaFilaEfetivamente();
      } else {
        if (status.recusado) sessionStorage.removeItem(`tele_refusal_${pacienteId}`);
        setTermoRecusado(false);
        setTermoAberto(true);
      }
    } catch {
      setTermoAberto(true);
    }
  };

  const handleEnviar = () => {
    if (!texto.trim()) {
      toast.error("Por favor, digite seus sintomas.");
      return;
    }
    processarSintomasDigitados(texto);
  };

  const responderPerguntasEReavaliar = () => {
    if (!resultadoTriagem?.perguntas) return;

    // 1. Persistir os valores dos sintomas (Febre e Dor) antes de reavaliar
    const novosValores: {[key: string]: string} = {};
    resultadoTriagem.perguntas.forEach((p, idx) => {
      // ⚡ CORREÇÃO: Pega o valor da resposta ou o DEFAULT se estiver undefined
      let val = respostas[idx];
      if (val === undefined && p.tipo === "range") {
         val = p.sintoma_relacionado?.toLowerCase() === "febre" ? "36.9" : "1";
      }

      if (val !== undefined) {
        if (p.sintoma_relacionado?.toLowerCase() === "febre" || p.pergunta.toLowerCase().includes("temperatura")) {
           novosValores["febre"] = val;
        } else if (p.sintoma_relacionado?.toLowerCase() === "cefaleia" || p.pergunta.toLowerCase().includes("dor")) {
           novosValores["cefaleia"] = val;
        } else if (p.sintoma_relacionado) {
           novosValores[p.sintoma_relacionado.toLowerCase()] = val;
        }
      }
    });
    setValoresSintomas(prev => ({ ...prev, ...novosValores }));

    setEnviandoRespostas(true);
    let respostasFormatadas = "";

    resultadoTriagem.perguntas.forEach((p, idx) => {
      // ⚡ CORREÇÃO: Mesma lógica para o texto enviado para a IA
      let resp = respostas[idx];
      if (resp === undefined && p.tipo === "range") {
         resp = p.sintoma_relacionado?.toLowerCase() === "febre" ? "36.9" : "1";
      }
      
      const textResp = resp || "Não soube responder";
      respostasFormatadas += `\n- Pergunta da IA: ${p.pergunta}\n- Resposta do Usuário: ${textResp}`;
    });

    const novoContexto = `Relato original: ${texto}\n\nRespostas às perguntas adicionais:${respostasFormatadas}`;
    processarSintomas(novoContexto, 'digitacao', true);

    setPerguntasResolvidas(true);
    setEnviandoRespostas(false);
  };

  const handleFechar = () => {
    // 🛡️ Salvamento Atômico: Tenta salvar se houver diagnóstico mas não foi persistido
    if (resultadoTriagem && !relatoId) {
      salvarRegistroUnico(resultadoTriagem, 'digitacao');
    }

    setTexto("");
    setRespostas({});
    setPerguntasResolvidas(false);
    limparProcessamento();
    try { pararAudio(); } catch (e) {}
    onClose();
  };

  return (
    <BottomSheetModal isOpen={isOpen} onClose={handleFechar}>
      <div className="flex flex-col items-center w-full space-y-6 p-4 overflow-hidden">
        
        {/* VIEW: CARREGAMENTO / PROCESSAMENTO */}
        {processando ? (
          <div className="text-center w-full min-h-[200px] flex flex-col items-center justify-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-600 mb-8">{etapaMensagem}</h2>
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : resultadoTriagem ? (
          /* VIEW: RESULTADO DA TRIAGEM */
          <div className="relative w-full max-h-[75vh] overflow-y-auto px-1 scrollbar-hide">
            <div className="absolute -top-6 right-2 flex items-center space-x-2">
              <button
                onClick={toggleAudio}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                title={audioHabilitado ? "Áudio habilitado" : "Áudio desabilitado"}
              >
                {audioHabilitado ? <FiVolume2 size={20} className="text-gray-600 dark:text-gray-300" /> : <FiVolumeX size={20} className="text-gray-600 dark:text-gray-300" />}
              </button>
              <button
                onClick={handleFechar}
                aria-label="Fechar modal"
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                <FiX size={20} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            {/* Sub-view: PERGUNTAS INTERATIVAS */}
            {resultadoTriagem.perguntas && resultadoTriagem.perguntas.length > 0 && !perguntasResolvidas ? (
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-md mb-6 border border-blue-200 dark:border-blue-800 w-full animate-fade-in">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">
                  Responda algumas perguntas
                </h2>
                <div className="flex flex-col gap-4">
                  <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                    Para um resultado mais preciso, por favor responda:
                  </p>
                  {resultadoTriagem.perguntas.map((p, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700">
                      <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        {p.pergunta}
                      </label>
                      {p.tipo === "range" ? (
                        <div className="flex flex-col gap-2">
                          {!perguntasFeverManual[idx] ? (
                            <>
                              <CustomSlider
                                min={p.sintoma_relacionado?.toLowerCase() === "febre" ? 35 : parseInt(p.opcoes?.split(" a ")[0] || "1")}
                                max={p.sintoma_relacionado?.toLowerCase() === "febre" ? 42 : parseInt(p.opcoes?.split(" a ")[1] || "10")}
                                step={p.sintoma_relacionado?.toLowerCase() === "febre" ? 0.1 : 1}
                                value={respostas[idx] !== undefined ? parseFloat(respostas[idx]) : (p.sintoma_relacionado?.toLowerCase() === "febre" ? 36.9 : 1)}
                                onChange={(val) => setRespostas(prev => ({ ...prev, [idx]: val.toString() }))}
                                color={p.sintoma_relacionado?.toLowerCase() === "febre" ? "bg-orange-500" : "bg-blue-600"}
                              />
                              {(p.sintoma_relacionado?.toLowerCase() === "febre" || p.sintoma_relacionado?.toLowerCase() === "dor" || p.pergunta.toLowerCase().includes("temperatura") || p.pergunta.toLowerCase().includes("dor")) && (
                                <button 
                                  onClick={() => setPerguntasFeverManual(prev => ({ ...prev, [idx]: true }))}
                                  className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline self-start"
                                >
                                  Está com dificuldade em selecionar?
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="flex flex-col gap-3 py-4">
                              <div className="flex items-center justify-center gap-4">
                                <button 
                                  onClick={() => {
                                    const isFebre = p.sintoma_relacionado?.toLowerCase() === "febre";
                                    const step = isFebre ? 0.1 : 1;
                                    const val = parseFloat(respostas[idx] || (isFebre ? "36.9" : "1"));
                                    setRespostas(prev => ({ ...prev, [idx]: isFebre ? (val - step).toFixed(1) : (val - step).toString() }));
                                  }}
                                  className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl font-bold text-gray-700 dark:text-gray-200"
                                >
                                  -
                                </button>
                                <input 
                                  type="number"
                                  inputMode={p.sintoma_relacionado?.toLowerCase() === "febre" ? "decimal" : "numeric"}
                                  step={p.sintoma_relacionado?.toLowerCase() === "febre" ? "0.1" : "1"}
                                  className="w-24 text-center text-2xl font-bold p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                  value={respostas[idx] || (p.sintoma_relacionado?.toLowerCase() === "febre" ? "36.9" : "1")}
                                  onChange={(e) => setRespostas(prev => ({ ...prev, [idx]: e.target.value }))}
                                />
                                <button 
                                  onClick={() => {
                                    const isFebre = p.sintoma_relacionado?.toLowerCase() === "febre";
                                    const step = isFebre ? 0.1 : 1;
                                    const val = parseFloat(respostas[idx] || (isFebre ? "36.9" : "1"));
                                    setRespostas(prev => ({ ...prev, [idx]: isFebre ? (val + step).toFixed(1) : (val + step).toString() }));
                                  }}
                                  className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl font-bold text-gray-700 dark:text-gray-200"
                                >
                                  +
                                </button>
                              </div>
                              <button 
                                onClick={() => setPerguntasFeverManual(prev => ({ ...prev, [idx]: false }))}
                                className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline self-center"
                              >
                                Voltar para o seletor
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder={p.placeholder || "Sua resposta"}
                          className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                          value={respostas[idx] || ""}
                          onChange={(e) => setRespostas(prev => ({ ...prev, [idx]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                  
                  <button
                    onClick={responderPerguntasEReavaliar}
                    disabled={enviandoRespostas}
                    className="mt-2 w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {enviandoRespostas ? "Enviando..." : "Confirmar Respostas"}
                  </button>

                  <button
                    onClick={() => {
                      const tId = toast.loading("Exibindo resultado...");
                      setTimeout(() => toast.dismiss(tId), 2000);
                      setPerguntasResolvidas(true);
                    }}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm underline mt-2 self-center"
                  >
                    Pular
                  </button>
                </div>
              </div>
            ) : (
              /* Sub-view: RESULTADO FINAL */
              <div className="space-y-6 animate-fade-in w-full">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-500 mb-4">
                  Resultado da pré-triagem
                </h2>

                <div className="mb-6">
                   <h3 className="text-lg font-medium text-gray-700 dark:text-gray-500 mb-4">
                     Sintomas identificados:
                   </h3>
                   <div className="flex flex-wrap gap-2">
                    {resultadoTriagem.sintomas.map((s, i) => {
                      let valorBadge = valoresSintomas[s.nome.toLowerCase()];
                      if (!valorBadge && s.nome.toLowerCase() === "cefaleia") {
                        valorBadge = valoresSintomas["cefaleia"] || valoresSintomas["dor"];
                      }

                      return (
                        <span key={i} className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-100 px-3 py-1.5 rounded-md text-sm flex items-center gap-2">
                          {s.nome}
                          {valorBadge !== null && valorBadge !== undefined && !isNaN(parseFloat(valorBadge)) && (
                            <span className="bg-blue-600 text-white px-2 py-0.5 rounded-lg text-[10px]">
                              {valorBadge}{s.nome.toLowerCase() === "febre" ? "°C" : "/10"}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col mb-4 bg-white dark:bg-gray-800 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between w-full mb-3">
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-400">
                      Classificação de risco
                    </h3>
                    <div 
                      className={`${getClassificacaoColor(resultadoTriagem.classificacao)} text-white font-bold px-4 py-1 rounded-md text-sm`}
                    >
                      {resultadoTriagem.classificacao.toUpperCase()}
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                    {resultadoTriagem.descricao}
                  </p>
                  <p className="mt-4 text-[11px] text-gray-400 dark:text-gray-500 italic flex items-center gap-1">
                    <FiAlertCircle size={14} className="text-orange-400" /> Esta classificação é preliminar e será reavaliada na unidade.
                  </p>
                </div>

                  {/* Risco Cirúrgico e Especialidade */}
                  {(resultadoTriagem.risco_cirurgico || resultadoTriagem.especialidade) && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4 w-full">
                      {resultadoTriagem.risco_cirurgico && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                          <span className="font-bold text-red-700 dark:text-red-300">
                            RISCO CIRÚRGICO IDENTIFICADO
                          </span>
                        </div>
                      )}
                      {resultadoTriagem.especialidade && (
                        <p className="text-gray-800 dark:text-gray-200 font-medium text-sm">
                          Especialidade indicada: <span className="text-blue-600 dark:text-blue-400 font-bold">{resultadoTriagem.especialidade}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Telemedicina (Se sugerido) */}
                  {resultadoTriagem.sugerir_telemedicina && (
                    <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 sm:p-5 rounded-md border border-blue-100 dark:border-blue-800/30 flex flex-col gap-3 mb-6">
                      <div className="flex items-center gap-3 text-left">
                        <div className="bg-blue-100 dark:bg-blue-800/50 p-2 rounded-full text-blue-600 dark:text-blue-400">
                          <FiVideo size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800 dark:text-gray-200">
                            Atendimento online disponível
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Você pode realizar sua consulta por vídeo agora mesmo.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 mt-2">
                        {hasActiveAppointment ? (
                          <div className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <FiCheck className="w-6 h-6 text-green-500" />
                            <span className="font-bold text-gray-500">Consulta online agendada</span>
                          </div>
                        ) : !medicosOnline ? (
                          <div className="relative group w-full">
                            <button
                              disabled
                              className="w-full flex justify-center items-center py-3 px-4 rounded-md shadow-sm text-gray-500 font-medium bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                            >
                              <FiVideo className="w-5 h-5 mr-1" />
                              Indisponível no momento
                              <span className="ml-1 bg-gray-400 dark:bg-gray-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold">?</span>
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-[18rem] p-3 bg-gray-900 border border-gray-700 text-white text-xs text-center rounded-lg shadow-xl z-[60]">
                              Não há médicos online na gestão da fila neste momento. Tente novamente posteriormente ou dirija-se presencialmente a unidade.
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={handleEntrarFila}
                            className={`w-full flex justify-center items-center py-3 px-4 rounded-md shadow-sm text-white font-medium ${tema.btnBg} ${tema.btnHover} focus:outline-none transition-colors`}
                          >
                            <FiVideo className="w-5 h-5 mr-2" />
                            {USE_TELEMEDICINE_QUEUE ? "Entre na fila" : "Agendar Telemedicina"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-2 w-full">
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-500 mb-1 text-left">
                      Local de atendimento:
                    </h3>
                    <p className="text-gray-700 dark:text-gray-400 font-medium mb-1 text-left">
                      {unidadeSelecionada?.nome || "Unidade próxima"}
                    </p>
                    {unidadeSelecionada?.endereco && (
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 text-left">
                        {unidadeSelecionada.endereco}
                      </p>
                    )}

                    {userLocation && unidadeSelecionada ? (
                      <div className="w-full h-64 mt-2 rounded-xl overflow-hidden shadow-inner border dark:border-gray-700">
                        <MapContainer
                          center={[(userLocation[0] + unidadeSelecionada.lat) / 2, (userLocation[1] + unidadeSelecionada.lng) / 2]}
                          zoom={13}
                          style={{ height: "100%", width: "100%" }}
                        >
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <Marker position={[unidadeSelecionada.lat, unidadeSelecionada.lng]} icon={iconMarker}>
                            <Popup>{unidadeSelecionada.nome}</Popup>
                          </Marker>
                          <Marker position={userLocation} icon={iconMarker}>
                            <Popup>Você está aqui</Popup>
                          </Marker>
                          <Polyline
                            positions={[userLocation, [unidadeSelecionada.lat, unidadeSelecionada.lng]]}
                            pathOptions={{ color: "blue", weight: 4 }}
                          />
                        </MapContainer>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-500 flex items-center justify-center border border-dashed border-gray-300">
                        Localização atual não disponível para o mapa.
                      </div>
                    )}

                    {qrToken ? (
                      <div className="mt-8 w-full border-t border-dashed dark:border-gray-700 pt-6">
                        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-500 mb-2 text-center">
                          QR Code para o check-in:
                        </h3>
                        <div className="p-2 rounded-md flex justify-center">
                          <QRCodeCanvas 
                            value={qrToken} 
                            size={160} 
                            bgColor={tema.btnBg === "dark" ? "#1F2937" : "#ffffff"}
                            fgColor={tema.btnBg === "dark" ? "#ffffff" : "#000000"}
                          />
                        </div>
                        <p className="mt-4 text-gray-400 dark:text-gray-500 text-xs text-center font-mono uppercase tracking-widest">{relatoId || "---"}</p>
                      </div>
                    ) : (
                      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400 text-center">
                        Gerando QR Code...
                      </div>
                    )}
                  </div>

                <button
                  onClick={handleFechar}
                  className={`w-full ${tema.btnBg} ${tema.btnHover} text-white font-semibold py-3 rounded-md transition`}
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        ) : (
          /* VIEW: DIGITAÇÃO INICIAL */
          <>
            <div className="flex justify-between items-center w-full px-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-600">Descreva seus sintomas</h2>
              <button onClick={handleFechar} className="p-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <FiX size={24} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>
            
            <div className="w-full px-4">
              <textarea
                ref={textareaRef}
                className="w-full h-48 p-4 text-lg rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white transition-all focus:border-blue-500 resize-none"
                placeholder="Ex: Estou com dor de cabeça forte há 2 dias e febre..."
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </div>

            <button
              onClick={handleEnviar}
              disabled={processando || !texto.trim()}
              className={`w-full ${tema.btnBg} ${tema.btnHover} text-white font-semibold py-3 rounded-md transition flex items-center justify-center gap-2 disabled:opacity-50`}
            >
              Analisar
              <FiSend size={20} />
            </button>
          </>
        )}
      </div>

      <AgendamentoModal
        isOpen={isAgendamentoOpen}
        onClose={() => setIsAgendamentoOpen(false)}
        pacienteId={pacienteId || ""}
        darkMode={tema.btnBg === "dark"}
      />

      {termoAberto && (
        <TermoTelemedinaModal
          isOpen={termoAberto}
          pacienteId={pacienteId}
          onAceitar={async () => {
            setTermoAberto(false);
            setTermoRecusado(false);
            if (pacienteId) await registrarDecisaoTelemedicina(pacienteId, "aceite");
            await entrarNaFilaEfetivamente();
          }}
          onFechar={handleRecusarTermo}
        />
      )}
    </BottomSheetModal>
  );
}