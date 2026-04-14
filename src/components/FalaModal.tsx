"use client";

import { FiX, FiCheck, FiCamera, FiMic, FiStopCircle, FiFile, FiVideo, FiVolume2, FiVolumeX, FiAlertCircle } from "react-icons/fi";
import { useAudioPlayer } from "./AudioPlayer";
import BottomSheetModal from "./BottomSheetModal";
import dynamic from "next/dynamic";
import { useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import AgendamentoModal from "./AgendamentoModal";
import { useRouter } from "next/navigation";
import TermoTelemedinaModal from "./TermoTelemedinaModal";
import { verificarStatusTelemedicina, registrarDecisaoTelemedicina, registrarAceiteCache } from "../lib/telemedicina";

const MapaRota = dynamic(() => import("./MapaRota"), { ssr: false });

import { QRCodeCanvas } from "qrcode.react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import CustomSlider from "./CustomSlider";
import PhotoUpload from "./PhotoUpload";

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

interface ExameUpload {
  arquivo?: File | null;
  base64?: string | null;
  descricao: string;
}

interface Tema {
  btnBg: string;
  btnHover: string;
  btnMap: string;
  btnHoverMap: string;
  toastBg: string;
  toastText: string;
}

interface FalaModalProps {
  isOpen: boolean;
  onClose: () => void;
  falaAtiva: boolean;
  tempoRestante: number;
  transcricao: string;
  processando: boolean;
  resultadoTriagem: ResultadoTriagem | null;
  etapaMensagem: string;
  origemProcessamento: "voz" | "digitacao" | null;
  finalizarFala: () => void;
  getClassificacaoColor: (classificacao: string) => string;
  CircularProgress: React.FC<{ progress: number }>;
  tema: Tema;
  limparProcessamento: () => void;
  pararAudio: () => void;
  // Novos props para exames
  processarSintomas: (texto: string, origem: 'voz' | 'digitacao', isReavaliacao?: boolean) => void;
  isMonitored: boolean;
  pacienteId: string;
  qrToken?: string | null;
  unidadeSelecionada?: {
    lat: number;
    lng: number;
    nome?: string;
    endereco?: string;
  } | null;
  userLocation?: [number, number] | null;
  historicoId?: string | null;
  // Botões de salvamento atômico
  fotoPendente: string | null;
  audioPendente: string | null;
  examePendenteState: { base64: string; descricao: string } | null;
  setFotoPendente: React.Dispatch<React.SetStateAction<string | null>>;
  setAudioPendente: React.Dispatch<React.SetStateAction<string | null>>;
  setExamePendenteState: React.Dispatch<React.SetStateAction<{ base64: string; descricao: string } | null>>;
  salvarRegistroUnico: (currentResultado?: any | null, forceOrigem?: 'voz' | 'digitacao' | null, forceTempo?: number | null) => Promise<void>;
}

export default function FalaModal({
  isOpen,
  onClose,
  falaAtiva,
  tempoRestante,
  transcricao,
  processando,
  resultadoTriagem,
  etapaMensagem,
  origemProcessamento,
  finalizarFala,
  getClassificacaoColor,
  CircularProgress,
  tema,
  limparProcessamento,
  pararAudio,
  qrToken,
  unidadeSelecionada,
  userLocation,
  historicoId,
  processarSintomas,
  pacienteId,
  isMonitored: isMonitoredProp,
  fotoPendente,
  audioPendente,
  examePendenteState,
  setFotoPendente,
  setAudioPendente,
  setExamePendenteState,
  salvarRegistroUnico,
}: FalaModalProps) {
  const { audioHabilitado, toggleAudio } = useAudioPlayer(tema);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Estados mancha
  const [fotoMancha, setFotoMancha] = useState<string | null>(null);
  const [loadingFoto, setLoadingFoto] = useState(false);
  const [mostrarModalImagem, setMostrarModalImagem] = useState(false);
  const [imagemCongelada, setImagemCongelada] = useState<string | null>(null);

  // Estados tosse
  const [gravandoTosse, setGravandoTosse] = useState(false);
  const [audioTosse, setAudioTosse] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Estados Exame (Risco Cirúrgico)
  const [examePendente, setExamePendente] = useState<ExameUpload>({ descricao: "" });
  const [enviandoExame, setEnviandoExame] = useState(false);
  const [modoCamera, setModoCamera] = useState<"mancha" | "exame">("mancha");

  // ... existing code

  const [exameSolicitadoResolvido, setExameSolicitadoResolvido] = useState(false);
  const [isAgendamentoOpen, setIsAgendamentoOpen] = useState(false);
  const [hasActiveAppointment, setHasActiveAppointment] = useState(false);
  const [isMonitoredLocal, setIsMonitoredLocal] = useState(isMonitoredProp);
    // Monitorar médicos online
    const [medicosOnline, setMedicosOnline] = useState(true);
    const [consentimentoJuridico, setConsentimentoJuridico] = useState(false);

    useEffect(() => {
        setIsMonitoredLocal(isMonitoredProp);
    }, [isMonitoredProp]);

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
  const router = useRouter();

  // Fila de Telemedicina
  const USE_TELEMEDICINE_QUEUE = true;

  const [termoAberto, setTermoAberto] = useState(false);
  const [termoRecusado, setTermoRecusado] = useState(false);

  // Sincroniza termoRecusado com cache e banco para persistência imediata e entre sessões
  useEffect(() => {
    const checkStatus = async () => {
      if (isOpen && pacienteId) {
        const status = await verificarStatusTelemedicina(pacienteId);
        setTermoRecusado(!!status.recusado);
      }
    };
    checkStatus();
  }, [isOpen, pacienteId]);

  const handleRecusarTermo = async () => {
    setTermoRecusado(true);
    setTermoAberto(false);
    if (pacienteId) {
      await registrarDecisaoTelemedicina(pacienteId, "recusa");
    }
  };

  // Entra efetivamente na fila (após termo aceito)
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
        if (status.recusado) {
           sessionStorage.removeItem(`tele_refusal_${pacienteId}`);
        }
        setTermoRecusado(false);
        setTermoAberto(true);
      }
    } catch {
      setTermoAberto(true);
    }
  };

  // Check for existing appointments
  useEffect(() => {
    const checkActiveAppointment = async () => {
      if (!pacienteId) return;
      try {
        const res = await fetch(`/api/agendamentos?paciente_id=${pacienteId}`);
        const appointments = await res.json();
        if (Array.isArray(appointments) && appointments.length > 0) {
          setHasActiveAppointment(true);
        } else {
          setHasActiveAppointment(false);
        }
      } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
      }
    };

    if (isOpen) {
      checkActiveAppointment();
    }
  }, [isOpen, pacienteId, isAgendamentoOpen]);


  // Estados Perguntas
  const [respostas, setRespostas] = useState<{ [key: number]: string }>({});
  const [perguntasResolvidas, setPerguntasResolvidas] = useState(false);
  const [enviandoRespostas, setEnviandoRespostas] = useState(false);
  const [perguntasFeverManual, setPerguntasFeverManual] = useState<{ [key: number]: boolean }>({});
  const [valoresSintomas, setValoresSintomas] = useState<{[key: string]: string}>({});

  // 🔹 RESETAR ÁUDIO E FOTO QUANDO O MODAL ABRIR
  useEffect(() => {
    if (isOpen) {
      setFotoMancha(null);
      setImagemCongelada(null);
      setAudioTosse(null);
      setGravandoTosse(false);
      setExamePendente({ descricao: "" });
      setEnviandoExame(false);
      setExameSolicitadoResolvido(false);
      setIsAgendamentoOpen(false);
      setRespostas({});
      setPerguntasResolvidas(false);
      setEnviandoRespostas(false);
      setPerguntasFeverManual({});
      setValoresSintomas({});
      setIsMonitoredLocal(isMonitoredProp);
    }
  }, [isOpen]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);

  const canvasRefTosse = useRef<HTMLCanvasElement>(null);


  // Abrir/fechar câmera
  useEffect(() => {
    if (cameraAberta) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then((s) => {
          setStream(s);
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(console.error);
    } else {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    }
  }, [cameraAberta]);

  const capturarFoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

      const imgData = canvasRef.current.toDataURL("image/png");

      if (modoCamera === "exame") {
        setExamePendente(prev => ({ ...prev, base64: imgData }));
        setCameraAberta(false);
        return;
      }

      setImagemCongelada(imgData);
      setLoadingFoto(true);
      toast.loading("Analisando imagem...", { id: "fotoMancha" });

      try {
        // ⚡ Salvamento Atômico: Apenas guarda em estado local
        setFotoPendente(imgData);
        setFotoMancha(imgData);
        toast.success("Imagem capturada para o registro final", { id: "fotoMancha" });
      } catch (err) {
          console.error(err);
          toast.error("Falha ao processar imagem", { id: "fotoMancha" });
        } finally {
          setLoadingFoto(false);
          setTimeout(() => {
            setCameraAberta(false);
            setImagemCongelada(null);
          }, 1500);
      }
    }
  };



  // Gravação de tosse
  const iniciarGravacaoTosse = async () => {
    setGravandoTosse(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // ✅ Definir mimeType cross-browser (iOS não aceita audio/mp4)
      let options: MediaRecorderOptions = { mimeType: "audio/webm" };
      if (options.mimeType && !MediaRecorder.isTypeSupported(options.mimeType)) {
        options = {}; // deixa o navegador escolher
      }
      const mediaRecorder = new MediaRecorder(stream, options);

      // Criar AudioContext e AnalyserNode
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      analyser.fftSize = 2048;

      // bufferLength e dataArray corretos
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // salvar referências
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;

      // Função para desenhar a onda
      const drawWave = () => {
        const canvas = canvasRefTosse.current;
        const analyserNode = analyserRef.current;
        const dataArrayLocal = dataArrayRef.current;

        if (!canvas || !analyserNode || !dataArrayLocal) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // pegar dados de áudio
        const safeArray = new Uint8Array(dataArrayLocal.length);
        analyserNode.getByteTimeDomainData(safeArray);

        // 🔎 detectar volume RMS
        const rms = Math.sqrt(
          safeArray.reduce((s, v) => s + Math.pow(v - 128, 2), 0) / safeArray.length
        );

        // só mostra o canvas se ultrapassar limite (ex.: tosse/voz forte)
        if (rms < 15) {
          canvas.style.display = "none";
          animationRef.current = requestAnimationFrame(drawWave);
          return;
        }

        canvas.style.display = "block";

        // desenhar onda
        ctx.clearRect(0, 0, width, height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#facc15";
        ctx.beginPath();

        const sliceWidth = width / safeArray.length;
        let x = 0;

        for (let i = 0; i < safeArray.length; i++) {
          const v = safeArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();

        animationRef.current = requestAnimationFrame(drawWave);
      };

      // iniciar animação
      drawWave();

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;

          // mostra que está processando
          toast.loading("Analisando áudio...", { id: "tosseAudio" });

          try {
            // 📎 Salvamento Atômico: Apenas guarda em estado local
            setAudioPendente(base64Audio);
            setAudioTosse(base64Audio);
            toast.success("Áudio preparado para o registro final", { id: "tosseAudio" });

            setTimeout(() => {
              setGravandoTosse(false);
            }, 1000);

          } catch (err) {
            console.error(err);
            toast.error("Erro ao preparar áudio", { id: "tosseAudio" });
            setGravandoTosse(false);
          }
        };
      };


      mediaRecorder.start();
    } catch (err) {
      console.error(err);
      setGravandoTosse(false);
    }
  };

  const pararGravacaoTosse = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (audioContextRef.current) audioContextRef.current.close();

    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  };

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  async function salvarInfoAdicional(
    tipo: "foto" | "áudio",
    arquivoBase64?: string,
    descricao?: string
  ) {
    if (!historicoId) return;

    try {
      const res = await fetch("/api/historico/info-adicional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          historico_id: historicoId,
          tipo,
          descricao: descricao ?? null,
          arquivoBase64: arquivoBase64 ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao salvar info adicional");
      return json; // json.fileUrl se seu backend retornar
    } catch (err) {
      console.error("Erro ao salvar info adicional:", err);
      throw err;
    }
  }

  const salvarExameEReavaliar = async () => {
    // Note: usamos transcricao como contexto base em vez de sintomas
    const contextoBase = transcricao || "";

    if (!examePendente.base64 || !historicoId || !examePendente.descricao) {
      toast.error("Dados do exame incompletos.");
      return;
    }

    setEnviandoExame(true);
    try {
      // 1. Salvar na tabela oficial de 'exames' (para aparecer no histórico)
      // Como o base64 contém o header "data:image/png;base64,...", podemos tentar enviar assim
      // Se a API 'exames' espera apenas o raw base64, removemos o header.
      const rawBase64 = examePendente.base64.split(",")[1];

      await fetch("/api/exames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: pacienteId,
          descricao: examePendente.descricao,
          pdf_exame: rawBase64
        })
      });

      toast.success("Exame preparado!");
      setExamePendente({
        base64: rawBase64,
        descricao: examePendenteUI.descricao
      });
      setExameSolicitadoResolvido(true);
      // O salvamento ocorrerá junto com o registro de triagem no fim do fluxo
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar exame.");
    } finally {
      setEnviandoExame(false);
    }
  };

  const responderPerguntasEReavaliar = () => {
    if (!resultadoTriagem?.perguntas) return;

    // Para FalaModal, usamos a transcricao como contexto base
    const contextoBase = transcricao || "";

    if (!resultadoTriagem?.perguntas || resultadoTriagem.perguntas.length === 0) return;

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

    toast.loading("Reavaliando respostas...", { id: "respostasToast" });
    const novoContexto = `Relato original: ${contextoBase}\n\nRespostas às perguntas adicionais:${respostasFormatadas}`;

    processarSintomas(novoContexto, origemProcessamento || 'voz', true);

    setPerguntasResolvidas(true);
    toast.success("Respostas recebidas!", { id: "respostasToast" });
    setEnviandoRespostas(false);
  };


  // cleanup ao fechar modal
  const handleFechar = () => {
    // 🛡️ Salvamento Atômico: Tenta salvar se houver diagnóstico mas não foi persistido
    if (resultadoTriagem && !historicoId) {
      salvarRegistroUnico(resultadoTriagem, origemProcessamento);
    }

    // parar câmera
    setCameraAberta(false);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }

    // parar gravação se estiver ativa
    if (gravandoTosse) pararGravacaoTosse();

    // limpar estados locais
    setFotoMancha(null);
    setImagemCongelada(null);
    setAudioTosse(null);
    setGravandoTosse(false);

    // avisar pai
    limparProcessamento();
    try { pararAudio && pararAudio(); } catch (e) { }

    // fechar modal
    onClose();
  };

  return (
    <>
    <BottomSheetModal isOpen={isOpen} onClose={() => { }}>
      <div className="flex flex-col items-center w-full max-h-[70vh] overflow-y-auto space-y-6 p-4">

        {resultadoTriagem && (
          <div className="relative w-full">
            <div className="absolute -top-6 right-2 flex items-center space-x-2">
              <button
                onClick={toggleAudio}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                title={audioHabilitado ? "Áudio habilitado" : "Áudio desabilitado"}
              >
                {audioHabilitado ? <FiVolume2 size={20} className="text-gray-600 dark:text-gray-300" /> : <FiVolumeX size={20} className="text-gray-600 dark:text-gray-300" />}
              </button>
              <button
                onClick={() => {
                  onClose();
                  limparProcessamento();
                  pararAudio();
                }}
                aria-label="Fechar modal"
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                <FiX size={20} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>
            {/* Overlay de Análise de Imagem */}
            {loadingFoto && (
              <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-3xl">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-white font-bold text-lg animate-pulse uppercase tracking-widest">Analisando imagem...</p>
              </div>
            )}
          </div>
        )}


        {/* Câmera overlay */}
        {cameraAberta && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black">
            <div className="relative w-full h-full flex items-center justify-center">
              {imagemCongelada ? (
                <img src={imagemCongelada} alt="Congelada" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
              )}

              <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <mask id="mancha-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <rect x="50%" y="50%" width="260" height="260" transform="translate(-130,-130)" fill="black" rx={4} />
                </mask>
                <rect width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#mancha-mask)" />
              </svg>

              {!imagemCongelada && (
                <p className="absolute bottom-[150px] w-full text-center text-white font-medium">
                  {modoCamera === "mancha" ? "Posicione a mancha dentro da área destacada" : "Foque o exame e capture a foto"}
                </p>
              )}

              {!imagemCongelada && (
                <div className="absolute bottom-[90px] w-full max-w-lg px-4">
                  <button
                    onClick={capturarFoto}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-md shadow transition flex items-center justify-center"
                  >
                    <FiCamera className="mr-2" /> Capturar a foto da mancha
                  </button>
                </div>
              )}

              {!imagemCongelada && (
                <div className="absolute bottom-[20px] w-full max-w-lg px-4 flex flex-col gap-2">
                  <button
                    onClick={() => setCameraAberta(false)}
                    className="w-full border-2 border-white/20 text-white/40 font-semibold py-2 px-6 rounded-md transition hover:bg-white/5 text-xs uppercase tracking-tighter"
                  >
                    Fechar
                  </button>
                  {modoCamera === "mancha" && (
                    <button
                      onClick={() => {
                         setCameraAberta(false);
                         // Encontrar a pergunta de foto e marcar como pulada
                         const indexFoto = resultadoTriagem?.perguntas?.findIndex((pq: any) => pq.pergunta.toLowerCase().includes("foto") || pq.pergunta.toLowerCase().includes("mancha"));
                         if (indexFoto !== -1 && indexFoto !== undefined) {
                            setRespostas(prev => ({ ...prev, [indexFoto]: "[NÃO ENVIADO]" }));
                         }
                         setFotoMancha("[PULADO]"); // Satisfaz a condição visual
                      }}
                      className="w-full text-blue-400 font-bold py-2 px-6 rounded-md transition hover:bg-blue-500/10 text-xs uppercase underline underline-offset-4"
                    >
                      Não quero enviar a foto agora
                    </button>
                  )}
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>
        )}

        {/* Conteúdo normal do modal */}
        {resultadoTriagem && origemProcessamento === "voz" ? (
          <>
            <div className="w-full">

              {resultadoTriagem.perguntas && resultadoTriagem.perguntas.length > 0 && !perguntasResolvidas ? (
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-md mb-6 border border-blue-200 dark:border-blue-800 w-full">
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
                        ) : (p.tipo === "input" && (p.pergunta.toLowerCase().includes("foto") || p.pergunta.toLowerCase().includes("mancha") || p.sintoma_relacionado?.toLowerCase() === "mancha")) ? (
                          <div className="mt-2">
                             <PhotoUpload 
                                photo={fotoMancha}
                                onPhotoCapture={() => {
                                  setModoCamera("mancha");
                                  setCameraAberta(true);
                                }}
                                onFileUpload={async (file) => {
                                   const reader = new FileReader();
                                   reader.onload = async () => {
                                      const base64 = reader.result as string;
                                      setLoadingFoto(true);
                                      try {
                                         const resp = await salvarInfoAdicional("foto", base64);
                                         const fileUrl = resp.fileUrl || base64;
                                         setFotoMancha(fileUrl);
                                         setRespostas(prev => ({ ...prev, [idx]: "[IMAGEM ENVIADA]" }));
                                         toast.success("Imagem anexada!");
                                      } catch (e) {
                                         toast.error("Erro ao enviar imagem.");
                                      } finally {
                                         setLoadingFoto(false);
                                      }
                                   };
                                   reader.readAsDataURL(file);
                                }}
                                onRemove={() => {
                                  setFotoMancha(null);
                                  setRespostas(prev => {
                                    const next = {...prev};
                                    delete next[idx];
                                    return next;
                                  });
                                }}
                                label="Clique para enviar a foto da mancha"
                             />
                          </div>
                        ) : p.tipo === "input" ? (
                          <input
                            type="text"
                            placeholder={p.placeholder || "Sua resposta"}
                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                            value={respostas[idx] || ""}
                            onChange={(e) => setRespostas(prev => ({ ...prev, [idx]: e.target.value }))}
                          />
                        ) : p.tipo === "select" ? (
                          <select
                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                            value={respostas[idx] || ""}
                            onChange={(e) => setRespostas(prev => ({ ...prev, [idx]: e.target.value }))}
                          >
                            <option value="">Selecione...</option>
                            {p.opcoes?.split(',').map((opt: string, oIdx: number) => (
                              <option key={oIdx} value={opt.trim()}>{opt.trim()}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                            value={respostas[idx] || ""}
                            onChange={(e) => setRespostas(prev => ({ ...prev, [idx]: e.target.value }))}
                          />
                        )}
                      </div>
                    ))}
                    <button
                      onClick={responderPerguntasEReavaliar}
                      disabled={enviandoRespostas || resultadoTriagem.perguntas.some((p, idx) => {
                         const responsed = respostas[idx] !== undefined;
                         const isRange = p.tipo === "range";
                         const isPhoto = p.pergunta.toLowerCase().includes("foto") || p.pergunta.toLowerCase().includes("mancha") || p.sintoma_relacionado?.toLowerCase() === "mancha";
                         
                         if (isPhoto) return !fotoMancha; // Bloqueia se não houver foto (ou se não foi pulado)
                         if (isRange) return false; // Dor/Febre agora mostram o botão mesmo sem toque (usam padrão)
                         return !responsed; // Outros campos ainda precisam de resposta
                      })}
                      className="mt-2 w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {enviandoRespostas ? "Enviando..." : "Confirmar Respostas"}
                    </button>
                    <button
                      onClick={() => {
                        const toastId = toast.loading("Exibindo resultado...");
                        setTimeout(() => toast.dismiss(toastId), 2000);
                        setPerguntasResolvidas(true);
                      }}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm underline mt-2 self-center"
                    >
                      Pular
                    </button>
                  </div>
                </div>
              ) : resultadoTriagem.acoes?.includes("pedir_exame") && !exameSolicitadoResolvido ? (
                <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-md mb-6 border border-red-200 dark:border-red-800 w-full">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-800 rounded-full text-red-600 dark:text-red-200">
                      <FiFile size={24} />
                      {/* Usando FiFile agora importado */}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                        Possui exames recentes?
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">
                        Para uma análise mais precisa, anexe exames recentes caso possua.
                      </p>

                      {!examePendente.base64 ? (
                        <div className="mt-4 flex flex-col gap-3">
                          <div className="flex gap-3 flex-wrap">
                            <button
                              onClick={() => { setModoCamera("exame"); setCameraAberta(true); }}
                              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
                            >
                              <FiCamera /> Fotografar Exame
                            </button>
                            <label className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md hover:bg-gray-300 cursor-pointer transition">
                              <FiFile /> Anexar Arquivo
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = () => setExamePendente(prev => ({ ...prev, base64: reader.result as string, descricao: file.name }));
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>

                          {/* BOTÃO PULAR */}
                          <button
                            onClick={() => {
                              const toastId = toast.loading("Exibindo resultado...");
                              setTimeout(() => toast.dismiss(toastId), 2000);
                              setExameSolicitadoResolvido(true);
                            }}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm underline mt-2 self-start"
                          >
                            Não tenho exames recentes
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700">
                          <p className="text-sm font-medium text-green-600 mb-2 flex items-center gap-2">
                            Exame anexado!
                          </p>
                          <p className="text-xs text-green-800 mb-1">{examePendente.descricao}</p>
                          {examePendente.base64?.startsWith("data:image") && (
                            <img src={examePendente.base64} alt="Preview" className="h-20 w-auto rounded-md mb-2 object-cover" />
                          )}
                          <input
                            type="text"
                            placeholder="Qual é este exame? (ex: Raio-X Braço)"
                            className="w-full text-sm p-2 border rounded-md mb-2 dark:bg-gray-700 dark:border-gray-600"
                            value={examePendente.descricao}
                            onChange={(e) => setExamePendente(prev => ({ ...prev, descricao: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={salvarExameEReavaliar}
                              disabled={enviandoExame}
                              className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
                            >
                              {enviandoExame ? "Enviando..." : "Enviar e Reavaliar"}
                            </button>
                            <button
                              onClick={() => setExamePendente({ descricao: "" })}
                              className="text-red-500 text-sm underline px-2"
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Ações mancha foto */}
                  {resultadoTriagem.acoes?.includes("mancha_foto") && !fotoMancha && !perguntasResolvidas && (
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-blue-100 dark:border-blue-900 shadow-sm mb-6">
                       <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                          <FiCamera className="text-blue-500" />
                          Precisamos de uma imagem da sua mancha
                       </h3>
                       <PhotoUpload 
                          photo={fotoMancha}
                          onPhotoCapture={() => {
                            setModoCamera("mancha");
                            setCameraAberta(true);
                          }}
                          onFileUpload={async (file) => {
                             const reader = new FileReader();
                             reader.onload = async () => {
                                const base64 = reader.result as string;
                                setLoadingFoto(true);
                                try {
                                   const resp = await salvarInfoAdicional("foto", base64);
                                   setFotoMancha(resp.fileUrl || base64);
                                   toast.success("Imagem enviada!");
                                   
                                   // Reavaliação
                                   const contextoBase = transcricao || "";
                                   const novoContexto = `${contextoBase}\n[SISTEMA]: Paciente anexou uma foto da mancha. Reavalie o caso.`;
                                   processarSintomas(novoContexto, origemProcessamento || 'voz', true);
                                } catch (e) {
                                   toast.error("Erro ao enviar imagem.");
                                } finally {
                                   setLoadingFoto(false);
                                }
                             };
                             reader.readAsDataURL(file);
                          }}
                          onRemove={() => setFotoMancha(null)}
                       />
                    </div>
                  )}

                  {/* Ações tosse áudio */}
                  {resultadoTriagem.acoes?.includes("tosse_audio") && !audioTosse && (
                    <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-md mb-4">

                      {/* Canvas só aparece enquanto grava */}
                      {gravandoTosse && (
                        <div className="mb-2">
                          <canvas
                            ref={canvasRefTosse}
                            className="w-full h-10 rounded-md"
                          />
                        </div>
                      )}

                      {/* Texto */}
                      <p className="text-gray-700 dark:text-gray-200 font-medium mb-2">
                        Precisamos entender melhor a tosse.
                      </p>

                      {/* Botão */}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-md transition"
                          onClick={gravandoTosse ? pararGravacaoTosse : iniciarGravacaoTosse}
                        >
                          {gravandoTosse ? (
                            <FiStopCircle className="mr-2" size={24} />
                          ) : (
                            <FiMic className="mr-2" size={24} />
                          )}
                          {gravandoTosse ? "Parar gravação" : "Capturar áudio"}
                        </button>
                      </div>
                    </div>
                  )}

                  <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-500 mb-4">
                    Resultado da pré-triagem
                  </h2>

                  {/* Sintomas */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-500 mb-4">
                      Sintomas identificados:
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {resultadoTriagem.sintomas.map((s, i) => {
                        // Tentar achar se esse sintoma tem um nível de dor associado nas respostas
                        // Tentar achar o valor persistido para este sintoma
                        let valorBadge = valoresSintomas[s.nome.toLowerCase()];
                        
                        // Fallback para mapeamento especial (Cefaleia <-> Dor)
                        if (!valorBadge && s.nome.toLowerCase() === "cefaleia") {
                          valorBadge = valoresSintomas["cefaleia"] || valoresSintomas["dor"];
                        }

                        return (
                          <span
                            key={i}
                            className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-100 px-3 py-1.5 rounded-md text-sm flex items-center gap-2"
                          >
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

                  {/* Foto capturada */}
                  {fotoMancha && (
                    <div className="mb-6 w-full">
                      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-500 mb-2 flex items-center gap-2">
                        Informações adicionais
                        <div className="group relative">
                          <span className="ml-1 bg-gray-400 dark:bg-gray-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold cursor-help">?</span>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-[18rem] p-3 bg-gray-900 border border-gray-700 text-white text-xs text-center rounded-lg shadow-xl z-50">
                            Apenas avaliação sugestiva que não substitui a avaliação médica, serve apenas para agilizar a tomada de decisão.
                          </div>
                        </div>
                      </h3>
                      <div className="flex items-start space-x-4">
                        <img
                          src={fotoMancha}
                          alt="Foto da mancha"
                          className="w-20 h-20 object-cover rounded-lg shadow-md cursor-pointer"
                          onClick={() => setMostrarModalImagem(true)}
                        />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-green-600 font-bold">
                             <FiCheck />
                             <span>Mancha avaliada</span>
                          </div>
                          <p className="text-[11px] text-gray-500 leading-tight">
                            A sugestão de resultado da análise foi enviada para a unidade.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Áudio tosse */}
                  {audioTosse && (
                    <div className="mb-6 w-full">
                      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-500 mb-2">
                        Informações adicionais
                      </h3>
                      <div className="flex items-center space-x-4">
                        <audio controls src={audioTosse} className="w-64" />
                        <button
                          className="text-yellow-600 border border-yellow-600 rounded-md px-3 py-2 text-sm hover:bg-yellow-50"
                          onClick={() => {
                            if (gravandoTosse) pararGravacaoTosse();
                            setAudioTosse(null); // limpa o áudio antigo
                            iniciarGravacaoTosse();
                          }}
                        >
                          Capturar novamente
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Classificação */}
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
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
                      {resultadoTriagem.risco_cirurgico && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                          <span className="font-bold text-red-700 dark:text-red-300">
                            RISCO CIRÚRGICO IDENTIFICADO
                          </span>
                        </div>
                      )}
                      {resultadoTriagem.especialidade && (
                        <p className="text-gray-800 dark:text-gray-200 font-medium">
                          Especialidade indicada: <span className="text-blue-600 dark:text-blue-400 font-bold">{resultadoTriagem.especialidade}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Local / Mapa / Telemedicina */}
                  {/* Telemedicina (Se sugerido) */}
                  {resultadoTriagem.sugerir_telemedicina && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 sm:p-5 rounded-md border border-blue-100 dark:border-blue-800/30 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 dark:bg-blue-800/50 p-2 rounded-full text-blue-600 dark:text-blue-400">
                          <FiVideo size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800 dark:text-gray-200">
                            Atendimento online disponível
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 text-left">
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

                  {/* Local / Mapa */}
                  {unidadeSelecionada && (
                    <div className="mt-6 w-full">
                      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-500 mb-1 text-left">
                        Local de atendimento:
                      </h3>
                      <p className="text-gray-700 dark:text-gray-400 font-medium mb-1 text-left">
                        {unidadeSelecionada.nome}
                      </p>
                      {unidadeSelecionada.endereco && (
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-2 text-left">
                          {unidadeSelecionada.endereco}
                        </p>
                      )}
                      
                      {userLocation ? (
                        <div className="w-full h-64 mt-2">
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
                    </div>
                  )}

                  {/* Check-in QR Code */}
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
                      <p className="mt-4 text-gray-400 dark:text-gray-500 text-xs text-center font-mono uppercase tracking-widest">{historicoId || "---"}</p>
                    </div>
                  ) : (
                    <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400 text-center">
                      Gerando QR Code de check-in...
                    </div>
                  )}
                </>
              )}


            </div>

            {/* Botão Fechar */}
            <button
              onClick={handleFechar}
              className={`w-full ${tema.btnBg} ${tema.btnHover} text-white font-semibold py-3 rounded-md transition`}
            >
              Fechar
            </button>
          </>
        ) : processando ? (
          <div className="text-center w-full min-h-[200px] flex flex-col items-center justify-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-600 mb-8">{etapaMensagem}</h2>
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center w-full px-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-600">{falaAtiva ? "Fale agora..." : "Aguardando..."}</h2>
              <button
                onClick={finalizarFala}
                aria-label="Finalizar gravação"
                className="p-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                <FiX size={24} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <CircularProgress progress={tempoRestante} />

            <h2 className="w-full p-1 rounded-md h-20 overflow-y-auto font-mono text-lg text-cyan-500 relative px-4">
              {transcricao || (falaAtiva ? "" : "Aguardando fala...")}
              {falaAtiva && <span className="futuristic-cursor">|</span>}
            </h2>

            <button
              type="button"
              onClick={finalizarFala}
              className={`w-full ${tema.btnBg} ${tema.btnHover} text-white font-semibold py-3 rounded-md transition`}
            >
              Finalizar
            </button>
          </>
        )
        }

        <AgendamentoModal
          isOpen={isAgendamentoOpen}
          onClose={() => setIsAgendamentoOpen(false)}
          pacienteId={pacienteId || ""}
          darkMode={tema.btnBg === "dark"}
        />
      </div >
    </BottomSheetModal >
    {termoAberto && (
      <TermoTelemedinaModal
        isOpen={termoAberto}
        pacienteId={pacienteId}
        onAceitar={async () => {
          setTermoAberto(false);
          setTermoRecusado(false);
          if (pacienteId) {
            await registrarDecisaoTelemedicina(pacienteId, "aceite");
          }
          await entrarNaFilaEfetivamente();
        }}
        onFechar={handleRecusarTermo}
      />
    )}
    </>
  );
}
