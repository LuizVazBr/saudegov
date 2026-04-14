"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FiX, FiCheck, FiCamera, FiMic, FiStopCircle, FiFile, FiVideo, FiVolume2, FiVolumeX, FiAlertCircle } from "react-icons/fi";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";
import { useAudioPlayer } from "./AudioPlayer";
import toast from "react-hot-toast";

interface Sintoma { nome: string; intensidade?: string; }
interface ResultadoTriagem {
  id: string;
  sintomas: Sintoma[];
  descricao: string;
  classificacao: string;
  relato?: string;
  expira?: string;
  lat?: number;
  lng?: number;
  acoes?: string[];
  perguntas?: any[];
}
interface JsonParcial { etapa?: string; resultadoTriagem?: ResultadoTriagem; isMonitored?: boolean; error?: string; detalhe?: string; }

interface SpeechRecognitionType {
  new(): {
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    lang: string;
    start(): void;
    stop(): void;
    onaudiostart?: () => void;
    onstart?: () => void;
    onresult?: (event: SpeechRecognitionEvent) => void;
    onerror?: (event: SpeechRecognitionErrorEvent) => void;
    onend?: () => void;
  };
}

interface SpeechRecognitionResultItem { transcript: string; }
interface SpeechRecognitionResult { 0: SpeechRecognitionResultItem; isFinal: boolean; }
interface SpeechRecognitionEvent { resultIndex: number; results: SpeechRecognitionResult[]; }
interface SpeechRecognitionErrorEvent { error: string; }

declare global {
  interface Window {
    webkitSpeechRecognition: SpeechRecognitionType;
  }
}


interface UseMicrophoneReturn {
  modalFalaAberto: boolean;
  modalInstrucoesAberto: boolean;
  falaAtiva: boolean;
  tempoRestante: number;
  volume: number;
  transcricao: string;
  processando: boolean;
  isMonitored: boolean;
  resultadoTriagem: ResultadoTriagem | null;
  microfonePronto: boolean;
  etapaProcessamento: number;
  etapaMensagem: string;
  origemProcessamento: 'voz' | 'digitacao' | null;
  fotoPendente: string | null;
  audioPendente: string | null;
  examePendente: { base64: string; descricao: string } | null;
  setFotoPendente: React.Dispatch<React.SetStateAction<string | null>>;
  setAudioPendente: React.Dispatch<React.SetStateAction<string | null>>;
  setExamePendente: React.Dispatch<React.SetStateAction<{ base64: string; descricao: string } | null>>;
  setModalFalaAberto: React.Dispatch<React.SetStateAction<boolean>>;
  setModalInstrucoesAberto: React.Dispatch<React.SetStateAction<boolean>>;
  setResultadoTriagem: React.Dispatch<React.SetStateAction<ResultadoTriagem | null>>;
  handleClickFalarSintomas: () => void;
  comecarAFalar: () => void;
  finalizarFala: () => void;
  processarSintomas: (texto: string, origem: 'voz' | 'digitacao', isReavaliacao?: boolean) => Promise<void>;
  pararAudio: () => void;
  limparProcessamento: () => void;
  CircularProgress: React.FC<{ progress: number }>;
  WaveformVisualizer: React.FC;
  getClassificacaoColor: (classificacao: string) => string;
}

interface UseMicrophoneProps {
  pacienteId: string;
  pacienteNome: string;
  sessionServer?: Session;
  onProcessarFim: (qrToken: string, transcricao: string) => void;
  onStopAudio?: () => void;
  tocarAudioResultado?: () => void;
  isMonitored?: boolean;
  userLocation?: [number, number] | null;
  tema?: any;
  isTeste?: boolean;
}

export const useMicrophone = ({ pacienteId, pacienteNome, sessionServer, onProcessarFim, onStopAudio, userLocation, tema, isTeste }: UseMicrophoneProps): UseMicrophoneReturn => {
  const [modalFalaAberto, setModalFalaAberto] = useState(false);
  const [modalInstrucoesAberto, setModalInstrucoesAberto] = useState(false);
  const [falaAtiva, setFalaAtiva] = useState(false);
  const [tempoRestante, setTempoRestante] = useState(60);
  const [volume, setVolume] = useState(0);
  const [transcricao, setTranscricao] = useState("");
  const [processando, setProcessando] = useState(false);
  const [isMonitored, setIsMonitored] = useState(false);
  const [resultadoTriagem, setResultadoTriagem] = useState<ResultadoTriagem | null>(null);
  const [microfonePronto, setMicrofonePronto] = useState(false);
  const [etapaProcessamento, setEtapaProcessamento] = useState(0);
  const [etapaMensagem, setEtapaMensagem] = useState("");
  const [origemProcessamento, setOrigemProcessamento] = useState<'voz' | 'digitacao' | null>(null);

  // 📎 Anexos Acumulativos (Salvamento Atômico)
  const [fotoPendente, setFotoPendente] = useState<string | null>(null);
  const [audioPendente, setAudioPendente] = useState<string | null>(null);
  const [examePendente, setExamePendente] = useState<{ base64: string; descricao: string } | null>(null);

  const reconhecimentoRef = useRef<InstanceType<SpeechRecognitionType> | null>(null);
  const textoFinalRef = useRef("");
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const tempoRestanteRef = useRef(60);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);


  const { tocarAudioResultado } = useAudioPlayer({ toastBg: tema?.toastBg || "#fff", toastText: tema?.toastText || "#000" });

  const tempoInicioRef = useRef<number | null>(null);

  const { data: sessionClient } = useSession();

  const session = sessionServer;
  const status = session ? "authenticated" : "unauthenticated";

  const isAndroid = typeof window !== "undefined" && (/Android/i.test(navigator.userAgent) || /Xiaomi/i.test(navigator.userAgent));

  const audioBufferRef = useRef<Blob | null>(null);
  const historicoIdRef = useRef<string | null>(null);
  const isSavingRef = useRef(false);

  const ENABLE_AUDIO_RECORDING = false;
  const salvoNoBancoRef = useRef(false);
  const toastIdRef = useRef<string | null>(null);

  const limparProcessamento = useCallback(() => {
    setProcessando(false);
    setResultadoTriagem(null);
    setIsMonitored(false);
    setOrigemProcessamento(null);
    setEtapaMensagem("");
    setEtapaProcessamento(0);
    salvoNoBancoRef.current = false;
    setTranscricao("");
    textoFinalRef.current = "";
    setTempoRestante(60);
    tempoRestanteRef.current = 60;
    setVolume(0);
  }, []);

  const stopRequestedRef = useRef(false); // 🚨 flag para parar o loop

  const enviarAudioHistorico = async (blob: Blob, historicoId: string) => {
    try {
      const formData = new FormData();
      formData.append("historicoId", historicoId);
      formData.append("audio", blob, "audio.webm"); // envia o blob diretamente

      const res = await fetch("/api/salvarAudio", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`Erro ao enviar áudio: ${res.statusText}`);

      //console.log("Áudio enviado para histórico:", historicoId);
    } catch (err) {
      console.error(err);
    }
  };




  const pararAudio = useCallback(() => {
    stopRequestedRef.current = true; // impede reinício

    if (reconhecimentoRef.current) {
      try { reconhecimentoRef.current.stop(); } catch { }
      reconhecimentoRef.current = null;
    }

    if (ENABLE_AUDIO_RECORDING) {
      // Para MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }

      // Para stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    }

    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    setFalaAtiva(false);
    setMicrofonePronto(false);
    setFotoPendente(null);
    setAudioPendente(null);
    setExamePendente(null);
    salvoNoBancoRef.current = false;
  }, []);

  const salvarRegistroUnico = useCallback(async (currentResultado?: ResultadoTriagem | null, forceOrigem?: 'voz' | 'digitacao' | null, forceTempo?: number | null) => {
    const resTriagem = currentResultado || resultadoTriagem;
    const currentOrigem = forceOrigem || origemProcessamento;
    const userId = pacienteId || sessionClient?.user?.id;

    if (!resTriagem || !userId || salvoNoBancoRef.current || isSavingRef.current) return;

    console.log("[useMicrophone] >>> INICIANDO SALVAMENTO ATÔMICO... ID:", userId);
    
    try {
      isSavingRef.current = true;
      const relatoRes = await fetch("/api/relato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paciente_id: userId,
          categoria_id: 1,
          descricao: resTriagem.relato,
          tipo: currentOrigem, 
          tempo_transcricao: currentOrigem === 'voz' ? (forceTempo || 0) : null,
          classificacao: resTriagem.classificacao,
          sintomas: resTriagem.sintomas || [],
          status: "iniciado",
          latitude: userLocation?.[0],
          longitude: userLocation?.[1],
          teste: isTeste,
          timestamp: new Date().toISOString(),
          fotoBase64: fotoPendente,
          audioBase64: audioPendente,
          exameBase64: examePendente?.base64,
          exameDescricao: examePendente?.descricao
        }),
      });

      const relatoData = await relatoRes.json();
      console.log("[useMicrophone] Resposta da persistência:", relatoData);

      if (relatoData.success && relatoData.historicoId) {
        salvoNoBancoRef.current = true;
        const historicoId = relatoData.historicoId;
        historicoIdRef.current = historicoId; 

        if (onProcessarFim) {
          onProcessarFim(historicoId, resTriagem.relato || "");
        }
      } else {
        console.error("[useMicrophone] Erro ao salvar relato:", relatoData.error);
      }
    } catch (err) {
      console.error("[useMicrophone] Exceção na persistência:", err);
    } finally {
      isSavingRef.current = false;
    }
  }, [resultadoTriagem, origemProcessamento, pacienteId, sessionClient, userLocation, fotoPendente, audioPendente, examePendente, onProcessarFim]);

  // 🛡️ Persistence Guard: Salva assim que todos os requisitos (IA + Anexos) forem cumpridos
  useEffect(() => {
    if (resultadoTriagem && !salvoNoBancoRef.current && !isSavingRef.current) {
      const temPerguntas = resultadoTriagem.perguntas && resultadoTriagem.perguntas.length > 0;
      const temAcoesPendentes = resultadoTriagem.acoes?.some(a => 
         (a === "mancha_foto" && !fotoPendente) || 
         (a === "tosse_audio" && !audioPendente)
      );

      if (!temPerguntas && !temAcoesPendentes) {
        salvarRegistroUnico();
      }
    }
  }, [resultadoTriagem, fotoPendente, audioPendente, salvarRegistroUnico]);

  const processarSintomas = useCallback(async (texto: string, origem: 'voz' | 'digitacao', isReavaliacao: boolean = false, tempoTranscricao: number | null = null) => {
    if (isReavaliacao) {
        // Para reavaliação, PERMITIMOS novo salvamento se o anterior não foi concluído
        // ou se estamos atualizando com novas informações (perguntas respondidas)
        salvoNoBancoRef.current = false; 
        setProcessando(true);
        setResultadoTriagem(null);
        setEtapaMensagem("Refinando análise...");
        setEtapaProcessamento(4);
    } else {
        limparProcessamento();
        salvoNoBancoRef.current = false; // Garante reset total
        setProcessando(true);
    }

    setOrigemProcessamento(origem);
    setTranscricao(texto);
    textoFinalRef.current = texto;

    const etapas = ["Processando sintomas...", "Acessando Genius...", "Extraindo informações...", "Classificando risco..."];

    try {
      const res = await fetch('/api/triagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sintomas: texto, pacienteId })
      });
      if (!res.ok) throw new Error('Erro na API');

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            if (!part.trim()) continue;
            let json: JsonParcial;
            try { json = JSON.parse(part); } catch {
              try {
                const trimmed = part.trim();
                if (trimmed.startsWith('"') && trimmed.endsWith('"')) json = JSON.parse(JSON.parse(trimmed));
                else throw new Error("Não é JSON válido");
              } catch { continue; }
            }

            // Se o backend mandou erro
            if (json.error) {
              toast.error("Erro ao processar sintomas. Tente novamente.");
              setEtapaMensagem("Erro ao processar sintomas");
              setProcessando(false);
              setModalFalaAberto(false);
              return;
            }

            if (json.etapa) {
              // Somente atualiza se não for reavaliação ou se for a etapa final (Classificando risco)
              const isFinalStage = json.etapa === "Classificando risco...";
              if (!isReavaliacao || isFinalStage) {
                setEtapaMensagem(json.etapa);
                setEtapaProcessamento(etapas.findIndex(e => e === json.etapa) + 1);
              }
            }

            if (json.resultadoTriagem) {
              const sintomas = json.resultadoTriagem.sintomas || [];
              const relato = json.resultadoTriagem.relato;

              // 🛡️ NOVO GATE: Só bloqueia se não houver NADA ÚTIL no resultado
              if (sintomas.length === 0 && (!relato || relato.length < 5)) {
                setProcessando(false);
                toast.error("Não foi possível entender o relato.");
                setResultadoTriagem(null);
                setModalFalaAberto(false);
                return; 
              }
              setResultadoTriagem(json.resultadoTriagem as ResultadoTriagem);
              if (json.isMonitored !== undefined) setIsMonitored(json.isMonitored);

              const temPerguntas = json.resultadoTriagem.perguntas && json.resultadoTriagem.perguntas.length > 0;
              const temAcoesInterativas = json.resultadoTriagem.acoes && (
                  json.resultadoTriagem.acoes.includes("mancha_foto") || 
                  json.resultadoTriagem.acoes.includes("tosse_audio")
              );

              // 📣 PERSISTÊNCIA ÚNICA: 
              // Agora delegada ao Persistence Guard (useEffect) que envia o relato 
              // atômico assim que perguntas e ações forem resolvidas.
              setProcessando(false);
            }
          }
        }
      }
    } catch (error) {
      toast.error("Erro ao processar sintomas.");
      setEtapaMensagem("Erro ao processar sintomas.");
      setProcessando(false);
      setModalFalaAberto(false);
    }
  }, [pacienteId, onProcessarFim, limparProcessamento, session, status, tocarAudioResultado]);

  const finalizarFala = useCallback(() => {
    pararAudio();
    const textoParaProcessar = textoFinalRef.current.trim() || transcricao.trim();
    // Calcula o tempo de transcrição
    const tempoTranscricao = tempoInicioRef.current
      ? Math.floor((Date.now() - tempoInicioRef.current) / 1000)
      : 0;

    if (textoParaProcessar) {
      processarSintomas(textoParaProcessar, 'voz');
    } else {
      setModalFalaAberto(false);
    }
  }, [pararAudio, processarSintomas, transcricao]);




  const falaAtivaRef = useRef(falaAtiva);

  useEffect(() => { falaAtivaRef.current = falaAtiva; }, [falaAtiva]);

  const iniciarGravacaoAudio = useCallback(async () => {
    // Pede permissão do microfone
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      }
    });

    mediaStreamRef.current = stream;

    // Cria MediaRecorder
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = recorder;
    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      audioBufferRef.current = blob; // 🔹 guarda temporariamente
      const url = URL.createObjectURL(blob);
    };

    recorder.start();

    // Para automaticamente após 60s
    setTimeout(() => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    }, 60000);

  }, []);

  const iniciarFala = useCallback(() => {
    pararAudio();
    limparProcessamento();
    stopRequestedRef.current = false;

    if (!("webkitSpeechRecognition" in window)) { alert("Seu navegador não suporta reconhecimento de voz!"); return; }

    setFalaAtiva(true);
    setTempoRestante(60);
    tempoRestanteRef.current = 60;

    if (ENABLE_AUDIO_RECORDING) {
      iniciarGravacaoAudio();
    }

    const recognition = new window.webkitSpeechRecognition();
    reconhecimentoRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    recognition.lang = "pt-BR-u-phonetic";


    recognition.onstart = () => {
      toastIdRef.current = toast("Aguarde...", {
        style: { background: "#e3f0e9ff", color: "#000", fontWeight: "bold" }
      });
    };

    recognition.onaudiostart = () => {
      if (toastIdRef.current) toast.dismiss(toastIdRef.current);
      setMicrofonePronto(true);
      setModalFalaAberto(true);
      toast.success("Comece a falar...", { style: { background: "#adfacfff", color: "#000", fontWeight: "bold" } });
      onStopAudio?.(); // 🛑 Para o áudio de instruções assim que o mic estiver pronto
    };

    recognition.onresult = (event) => {
      onStopAudio?.(); // 🛑 Garante que o áudio pare ao detectar fala
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          textoFinalRef.current += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }
      setTranscricao(textoFinalRef.current + interimTranscript);
    };


    recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      
      if (toastIdRef.current) toast.dismiss(toastIdRef.current);

      if (event.error === "audio-capture") {
        toast.error("Erro no microfone. Verifique se ele está sendo usado por outro app ou se as permissões estão corretas.");
        stopRequestedRef.current = true;
        setFalaAtiva(false);
      } else if (event.error === "not-allowed") {
        toast.error("Acesso ao microfone negado pelo navegador.");
        stopRequestedRef.current = true;
        setFalaAtiva(false);
      } else if (!stopRequestedRef.current) {
        // tenta reiniciar para erros transitórios (ex: network)
        try { recognition.start(); } catch { }
      }
    };

    recognition.onend = () => {
      if (!stopRequestedRef.current && falaAtivaRef.current && tempoRestanteRef.current > 0) {
        try { recognition.start(); } catch (err) { console.warn(err); }
      } else {
        setFalaAtiva(false);
        setMicrofonePronto(false);
      }
    };

    recognition.start();

    // Contador de tempo
    intervalIdRef.current = setInterval(() => {
      if (stopRequestedRef.current) return;
      tempoRestanteRef.current -= 1;
      setTempoRestante(tempoRestanteRef.current);
      if (tempoRestanteRef.current <= 0) {
        if (intervalIdRef.current) clearInterval(intervalIdRef.current);
        finalizarFala();
      }
    }, 1000);

  }, [limparProcessamento, pararAudio, finalizarFala, isAndroid]);


  const handleClickFalarSintomas = useCallback(() => {
    const jaViuInstrucoes = localStorage.getItem("jaViuInstrucoesFalarSintomas");
    if (!jaViuInstrucoes) setModalInstrucoesAberto(true);
    else { iniciarFala(); }
  }, [iniciarFala]);

  const comecarAFalar = useCallback(() => {
    localStorage.setItem("jaViuInstrucoesFalarSintomas", "true");
    setModalInstrucoesAberto(false);
    iniciarFala();
  }, [iniciarFala]);

  const CircularProgress = useCallback(({ progress }: { progress: number }) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 60) * circumference;
    return (
      <svg className="w-24 h-24">
        <circle className="text-gray-200 dark:text-gray-600" strokeWidth={8} stroke="currentColor" fill="transparent" r={radius} cx="50%" cy="50%" />
        <circle className="text-blue-500" strokeWidth={8} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx="50%" cy="50%" transform="rotate(-90 50 50)" />
        <text x="50%" y="50%" textAnchor="middle" dy="0.3em" className="text-lg font-semibold">{progress}s</text>
      </svg>
    );
  }, []);

  const WaveformVisualizer = useCallback(() => <canvas width={300} height={100} />, []); // Android não ativa

  const getClassificacaoColor = useCallback((classificacao: string) => {
    switch (classificacao.toLowerCase()) {
      case "vermelho": return "bg-red-500";
      case "laranja": return "bg-orange-500";
      case "amarelo": return "bg-yellow-500";
      case "verde": return "bg-green-500";
      case "azul": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  }, []);

  return {
    modalFalaAberto,
    modalInstrucoesAberto,
    falaAtiva,
    tempoRestante,
    volume,
    transcricao,
    processando,
    resultadoTriagem,
    microfonePronto,
    etapaProcessamento,
    etapaMensagem,
    origemProcessamento,
    isMonitored,
    setModalFalaAberto,
    setModalInstrucoesAberto,
    setResultadoTriagem,
    handleClickFalarSintomas,
    comecarAFalar,
    finalizarFala,
    processarSintomas,
    pararAudio,
    limparProcessamento,
    CircularProgress,
    WaveformVisualizer,
    getClassificacaoColor,
    fotoPendente,
    audioPendente,
    examePendente,
    setFotoPendente,
    setAudioPendente,
    setExamePendente,
    salvarRegistroUnico
  };
};
