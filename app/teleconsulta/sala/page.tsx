"use client";

import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Users,
  Loader2,
  Wifi,
  WifiOff,
  LayoutGrid,
  Maximize,
  Minimize,
  MessageSquare,
  FileText,
  Plus,
  Download,
  MicOff as MicOffIcon,
  Circle,
  Square as StopIcon,
  Check
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import DocumentoTeleconsultaModal from "@/components/DocumentoTeleconsultaModal";
import AcoesConsultaModal from "@/components/AcoesConsultaModal";
import ProntuarioModal from "@/components/ProntuarioModal";
import AIReviewModal from "@/components/AIReviewModal";
import TratamentoModal from "@/components/TratamentoModal";
import CondicaoModal from "@/components/CondicaoModal";
import { DocumentType, generatePdfTeleconsulta } from "@/utils/generatePdfTeleconsulta";

interface TranscriptionMsg {
  sender: string;
  text: string;
  isDocument?: boolean;
  docType?: string;
  extraData?: any;
}

interface Participant {
  socketId: string;
  identity: string;
  peerConnection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  stream?: MediaStream;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
}

interface ICEConfig {
  iceServers: RTCIceServer[];
  signalingServerUrl: string;
}

export default function TeleconsultaRoom() {
  const router = useRouter();

  // State Lobby
  const [identity, setIdentity] = useState("");
  const [roomName, setRoomName] = useState("");
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // State Room
  const [isInRoom, setIsInRoom] = useState(false);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<"good" | "poor" | "disconnected">("good");
  const [viewMode, setViewMode] = useState<"grid" | "spotlight">("spotlight");
  const [focusedUser, setFocusedUser] = useState<"local" | "remote">("remote");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto join & Transcriptions
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionMsg[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Documentos e Prontuário
  const [isMedico, setIsMedico] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showAcoesModal, setShowAcoesModal] = useState(false);
  const [showProntuarioModal, setShowProntuarioModal] = useState(false);
  const [showTratamentoModal, setShowTratamentoModal] = useState(false);
  const [showCondicaoModal, setShowCondicaoModal] = useState(false);
  const [pacienteId, setPacienteId] = useState("");
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [medicamentosDaReceita, setMedicamentosDaReceita] = useState<any[]>([]);

  // Recording & AI States
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [remoteTranscriptionStatus, setRemoteTranscriptionStatus] = useState<'off' | 'recording' | 'processing' | 'completed'>('off');
  const [aiResult, setAiResult] = useState<any>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderMedRef = useRef<MediaRecorder | null>(null);
  const mediaRecorderPacRef = useRef<MediaRecorder | null>(null);
  const audioChunksMedRef = useRef<Blob[]>([]);
  const audioChunksPacRef = useRef<Blob[]>([]);

  // Refs de WebRTC
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const iceConfigRef = useRef<ICEConfig | null>(null);
  const participantsRef = useRef<Map<string, Participant>>(new Map());
  const isAudioEnabledRef = useRef(true);
  const isVideoEnabledRef = useRef(true);
  const recordingStartTimeRef = useRef<number | null>(null);


  useEffect(() => {
    const urlRoom = searchParams.get("room");
    const isMedicoUrl = window.location.href.includes("medico") || searchParams.get("medico") === "true";
    const userRole = session?.user?.tipo_usuario?.toLowerCase().trim();
    const isMedicoSession = userRole === 'medico' || userRole === 'enfermeiro';
    
    const urlPacienteId = searchParams.get("pacienteId") || "";
    setIsMedico(isMedicoUrl || isMedicoSession);
    setPacienteId(urlPacienteId);
    
    const urlName = searchParams.get("nome") || (isMedicoUrl || isMedicoSession ? "Médico" : "Paciente");

    if (urlRoom && !autoJoinAttempted) {
      setRoomName(urlRoom);
      setIdentity(urlName);
      setAutoJoinAttempted(true);
    }
  }, [searchParams, autoJoinAttempted]);

  useEffect(() => {
    if (autoJoinAttempted && roomName && identity && !isInRoom && !isConnecting) {
      joinRoom();
    }
  }, [autoJoinAttempted, roomName, identity, isInRoom, isConnecting]);

  useEffect(() => {
    if (isInRoom && !isMedico && roomName) {
      // Sinaliza via API que o paciente já conectou
      fetch('/api/fila/paciente_entrou', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName })
      }).catch(console.error);
    }
  }, [isInRoom, isMedico, roomName]);

  // Detecta quando o paciente sai da página sem clicar em "Sair da sala"
  // (botão voltar, fechar aba, etc.)
  useEffect(() => {
    if (!isInRoom || isMedico || !roomName) return;

    const notifyPacienteSaiu = () => {
      const payload = JSON.stringify({ roomName });
      // sendBeacon é mais confiável durante o unload da página
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/fila/paciente_saiu', blob);
      } else {
        fetch('/api/fila/paciente_saiu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true  // mantém a requisição mesmo após o pagehide
        }).catch(console.error);
      }
    };

    const handleBeforeUnload = () => {
      notifyPacienteSaiu();
    };

    const handleVisibilityChange = () => {
      // Quando a página fica oculta (minimizado, troca de aba, etc.)
      if (document.visibilityState === 'hidden') {
        notifyPacienteSaiu();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isInRoom, isMedico, roomName]);


  // Speech Recognition Initialization
  useEffect(() => {
    if (typeof window !== "undefined" && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'pt-BR';

      recognitionRef.current.onresult = (event: any) => {
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          }
        }
        if (final.trim()) {
          // Send to ALL DataChannels
          participantsRef.current.forEach(p => {
            if (p.dataChannel && p.dataChannel.readyState === "open") {
              p.dataChannel.send(final);
            }
          });
          setTranscriptions(prev => [...prev, { sender: identity || "Você", text: final }]);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
          setIsTranscribing(false);
        }
      };

      // Removed onend auto-restart to prevent rapid looping errors if mic drops
    }
  }, [identity]);

  const startRecording = async () => {
    try {
      if (!localStreamRef.current) {
        toast.error("Ocorreu um erro ao acessar o stream local.");
        return;
      }

      const patient = Array.from(participantsRef.current.values())[0];
      if (!patient?.stream) {
        toast.error("Aguarde o paciente conectar o áudio para iniciar a transcrição.");
        return;
      }

      // Função auxiliar para criar MediaRecorder com fallback
      const createRecorder = (stream: MediaStream, chunksArrRef: React.MutableRefObject<Blob[]>) => {
        // Garantir que gravamos APENAS áudio para máxima compatibilidade e menor banda
        const audioOnlyStream = new MediaStream(stream.getAudioTracks());
        if (audioOnlyStream.getAudioTracks().length === 0) {
          throw new Error("Stream não possui trilhas de áudio.");
        }

        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/aac', 'audio/mp4'];
        let recorder: MediaRecorder | null = null;

        // Tenta com MimeTypes preferidos
        for (const type of types) {
          if (MediaRecorder.isTypeSupported(type)) {
            try {
              recorder = new MediaRecorder(audioOnlyStream, { mimeType: type });
              console.log(`MediaRecorder criado com sucesso (${type})`);
              break;
            } catch (e) {
              console.warn(`Falha ao criar MediaRecorder com ${type}, tentando próximo...`);
            }
          }
        }

        // Fallback final: sem opções (o browser escolhe o padrão dele)
        if (!recorder) {
          try {
            recorder = new MediaRecorder(audioOnlyStream);
            console.log("MediaRecorder criado com fallback padrão (sem mimeType)");
          } catch (e) {
            throw new Error("Nenhum codec de áudio suportado para gravação neste navegador.");
          }
        }

        chunksArrRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksArrRef.current.push(e.data);
        };

        return recorder;
      };

      // Inicializa os gravadores
      mediaRecorderMedRef.current = createRecorder(localStreamRef.current, audioChunksMedRef);
      mediaRecorderPacRef.current = createRecorder(patient.stream, audioChunksPacRef);

      // Inicia com tratamento de erro específico
      try {
        mediaRecorderMedRef.current.start(1000); // Timeslice ajuda a não perder dados em crashes
        mediaRecorderPacRef.current.start(1000);
      } catch (err) {
        console.error("Erro no start() do recorder:", err);
        // Tenta sem timeslice se falhar
        mediaRecorderMedRef.current.start();
        mediaRecorderPacRef.current.start();
      }

      setIsRecording(true);
      recordingStartTimeRef.current = Date.now();
      socketRef.current?.emit("transcription-status", { to: null, status: 'recording' });
      toast.success("Transcrição iniciada. O paciente está sendo notificado.");
    } catch (error: any) {
      console.error("Erro fatal ao iniciar gravação:", error);
      toast.error(`Não foi possível iniciar a gravação: ${error.message || "Erro desconhecido"}`);
    }
  };

  const stopRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      const stopTime = Date.now();
      let blobsFinalizados = 0;
      let blobMed: Blob | null = null;
      let blobPac: Blob | null = null;

      const checkAndProcess = () => {
        blobsFinalizados++;
        if (blobsFinalizados === 2 && blobMed && blobPac) {
          const durationSeconds = recordingStartTimeRef.current 
            ? Math.floor((stopTime - recordingStartTimeRef.current) / 1000) 
            : 0;
          processTranscription(blobMed, blobPac, durationSeconds);
        }
      };

      if (mediaRecorderMedRef.current) {
        mediaRecorderMedRef.current.onstop = () => {
          blobMed = new Blob(audioChunksMedRef.current, { type: 'audio/webm' });
          checkAndProcess();
        };
        mediaRecorderMedRef.current.stop();
      }

      if (mediaRecorderPacRef.current) {
        mediaRecorderPacRef.current.onstop = () => {
          blobPac = new Blob(audioChunksPacRef.current, { type: 'audio/webm' });
          checkAndProcess();
        };
        mediaRecorderPacRef.current.stop();
      }

      setIsProcessingAI(true);
      socketRef.current?.emit("transcription-status", { to: null, status: 'processing' });
      toast("Finalizando gravação e gerando relatório...");
    }
  };

  const processTranscription = async (blobMed: Blob, blobPac: Blob, durationSeconds: number) => {
    try {
      console.log(`Enviando áudio para transcrição: Médico (${blobMed.size} bytes), Paciente (${blobPac.size} bytes). Duração: ${durationSeconds}s`);
      const formData = new FormData();
      formData.append("audioMedico", blobMed, "medico.webm");
      formData.append("audioPaciente", blobPac, "paciente.webm");
      formData.append("pacienteId", pacienteId);
      formData.append("durationSeconds", durationSeconds.toString());

      const response = await fetch("/api/teleconsulta/transcreva", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      console.log("Resposta da transcrição:", data);
      setIsProcessingAI(false);

      if (data.success) {
        setAiResult({
          ...data.resultado,
          tempoTranscricao: durationSeconds
        });
        setShowAIModal(true);
      } else {
        toast.error("Erro no processamento de IA: " + data.error);
      }
    } catch (error) {
      console.error("Erro ao processar áudio:", error);
      setIsProcessingAI(false);
      toast.error("Erro ao enviar áudio para transcrição.");
    } finally {
      socketRef.current?.emit("transcription-status", { to: null, status: 'completed' });
      setTimeout(() => {
        socketRef.current?.emit("transcription-status", { to: null, status: 'off' });
      }, 4000);
    }
  };

  const toggleTranscription = () => {
    if (!recognitionRef.current) {
      toast.error("Navegador não suporta transcrição.");
      return;
    }
    if (isTranscribing) {
      recognitionRef.current.stop();
      setIsTranscribing(false);
      toast("Transcrição de áudio desativada");
    } else {
      try {
        recognitionRef.current.start();
        setIsTranscribing(true);
        toast.success("Transcrição de áudio ativada");
      } catch (e) { console.error(e); }
    }
  };

  const setupDataChannel = (dc: RTCDataChannel, remoteIdentity: string) => {
    dc.onmessage = (event) => {
      try {
        // Tenta parsear como JSON (pode ser documento)
        const data = JSON.parse(event.data);

        if (data.type === 'end-call') {
          toast.error("A teleconsulta foi encerrada pelo médico.");
          leaveRoom(true); // Param true = fromRemote
          return;
        }

        if (data.type === 'document') {
          setTranscriptions(prev => [...prev, {
            sender: remoteIdentity,
            text: data.content,
            isDocument: true,
            docType: data.docType
          }]);
          setShowChat(true); // Abre o chat automaticamente para mostrar o documento
          toast.success(`${remoteIdentity} enviou um(a) ${data.docType}`);
        } else {
          setTranscriptions(prev => [...prev, { sender: remoteIdentity, text: event.data }]);
        }
      } catch (e) {
        // Se falhar o parse, é texto normal da transcrição
        setTranscriptions(prev => [...prev, { sender: remoteIdentity, text: event.data }]);
      }
    };
  };




  // Helper to update participants in both Ref (for logic) and State (for UI)
  const updateParticipantsMap = (fn: (prev: Map<string, Participant>) => Map<string, Participant>) => {
    setParticipants(prev => {
      const newMap = fn(prev);
      participantsRef.current = newMap;
      return newMap;
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, []);

  // Fix: Ensure local video is attached when entering room
  useEffect(() => {
    if (isInRoom && localVideoRef.current && localStreamRef.current) {
      console.log("Anexando stream local ao elemento de vídeo (useEffect)");
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(e => console.error("Erro no play local:", e));
    }
  }, [isInRoom]);

  // --- WebRTC Helper Functions ---

  const createPeerConnection = (remoteSocketId: string, remoteIdentity: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: iceConfigRef.current?.iceServers || [
        { urls: "stun:stun.l.google.com:19302" }
      ]
    });

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          to: remoteSocketId,
          candidate: event.candidate
        });
      }
    };

    // Handle incoming data channel
    pc.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      setupDataChannel(receiveChannel, remoteIdentity);

      updateParticipantsMap(prev => {
        const updated = new Map(prev);
        const participant = updated.get(remoteSocketId);
        if (participant) {
          participant.dataChannel = receiveChannel;
          updated.set(remoteSocketId, participant);
        }
        return updated;
      });
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      console.log(`Recebendo stream de ${remoteIdentity}:`, {
        streamId: stream?.id,
        videoTracks: stream?.getVideoTracks().length || 0,
        audioTracks: stream?.getAudioTracks().length || 0,
        active: stream?.active,
        trackKind: event.track.kind,
        trackEnabled: event.track.enabled,
        trackReadyState: event.track.readyState
      });

      if (!stream) {
        console.error(`Stream vazio recebido de ${remoteIdentity}`);
        return;
      }

      updateParticipantsMap(prev => {
        const updated = new Map(prev);
        const participant = updated.get(remoteSocketId);
        if (participant) {
          participant.stream = stream;
          updated.set(remoteSocketId, participant);
        } else {
          // Criar participante se não existir
          updated.set(remoteSocketId, {
            socketId: remoteSocketId,
            identity: remoteIdentity,
            stream: stream
          });
        }
        return updated;
      });
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${remoteIdentity}: ${pc.connectionState}`);

      if (pc.connectionState === "connected") {
        setConnectionQuality("good");
        toast.success(`Conectado com ${remoteIdentity}`);
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setConnectionQuality("poor");
        toast.error(`Conexão com ${remoteIdentity} perdida`);
      }
    };

    // Monitor ICE gathering state
    pc.onicegatheringstatechange = () => {
      console.log(`ICE gathering state with ${remoteIdentity}: ${pc.iceGatheringState}`);
    };

    // Monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${remoteIdentity}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        console.error('ICE connection failed - TURN server may not be working');
        toast.error('Falha na conexão ICE - verifique TURN server');
      }
    };

    return pc;
  };

  const createOffer = async (remoteSocketId: string, remoteIdentity: string) => {
    try {
      const pc = createPeerConnection(remoteSocketId, remoteIdentity);

      const dc = pc.createDataChannel("chat");
      setupDataChannel(dc, remoteIdentity);

      updateParticipantsMap(prev => {
        const updated = new Map(prev);
        const participant = updated.get(remoteSocketId) || { socketId: remoteSocketId, identity: remoteIdentity };
        participant.peerConnection = pc;
        participant.dataChannel = dc;
        updated.set(remoteSocketId, participant);
        return updated;
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current?.emit("offer", {
        to: remoteSocketId,
        offer: offer
      });

      console.log(`Oferta enviada para ${remoteIdentity}`);
    } catch (error) {
      console.error("Erro ao criar oferta:", error);
      toast.error("Erro ao conectar com participante");
    }
  };

  const handleOffer = async (from: string, offer: RTCSessionDescriptionInit, fromIdentity: string) => {
    try {
      const pc = createPeerConnection(from, fromIdentity);

      updateParticipantsMap(prev => {
        const updated = new Map(prev);
        const participant = updated.get(from) || { socketId: from, identity: fromIdentity };
        participant.peerConnection = pc;
        updated.set(from, participant);
        return updated;
      });

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current?.emit("answer", {
        to: from,
        answer: answer
      });

      console.log(`Resposta enviada para ${fromIdentity}`);
    } catch (error) {
      console.error("Erro ao processar oferta:", error);
      toast.error("Erro ao conectar com participante");
    }
  };

  const handleAnswer = async (from: string, answer: RTCSessionDescriptionInit) => {
    try {
      const participant = participantsRef.current.get(from);
      if (participant?.peerConnection) {
        await participant.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`Resposta recebida de ${participant.identity}`);
      } else {
        console.warn(`Recebida resposta de ${from} mas participante não encontrado ou sem PC`);
      }
    } catch (error) {
      console.error("Erro ao processar resposta:", error);
    }
  };

  const handleIceCandidate = async (from: string, candidate: RTCIceCandidateInit) => {
    try {
      const participant = participantsRef.current.get(from);
      if (participant?.peerConnection) {
        await participant.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`ICE Candidate adicionado de ${participant.identity}`);
      } else {
        console.warn(`Recebido ICE Candidate de ${from} mas PC não encontrado na Ref`);
      }
    } catch (error) {
      console.error("Erro ao adicionar ICE candidate:", error);
    }
  };

  // --- Join Room ---

  const joinRoom = async () => {
    if (!identity || !roomName) {
      toast.error("Por favor, preencha seu nome e o nome da sala.");
      return;
    }

    setIsConnecting(true);

    try {
      const isMedicoUrl = window.location.href.includes("medico=true") || window.location.href.includes("medico");

      // Before joining, patients must verify room is still valid
      if (!isMedicoUrl && pacienteId) {
        try {
          const statusRes = await fetch(`/api/fila/status?pacienteId=${encodeURIComponent(pacienteId)}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.status === 'cancelado' || statusData.status === 'expirado') {
              toast.error("Esta solicitação expirou ou foi cancelada.");
              setIsConnecting(false);
              setTimeout(() => {
                window.location.href = "/fila-telemedicina";
              }, 1500);
              return;
            }
          }
        } catch (e) {
          console.error("Failed to check queue status before join", e);
        }
      }

      // Also check specifically by room_name (more precise – even if pacienteId check passes)
      if (!isMedicoUrl && roomName) {
        try {
          const salaRes = await fetch(`/api/fila/sala-status?roomName=${encodeURIComponent(roomName)}`);
          if (salaRes.ok) {
            const salaData = await salaRes.json();
            if (salaData.status === 'cancelado' || salaData.status === 'expirado' || salaData.status === 'finalizado') {
              toast.error("Esta solicitação expirou ou foi encerrada.");
              setIsConnecting(false);
              setTimeout(() => {
                window.location.href = "/fila-telemedicina";
              }, 1500);
              return;
            }
          }
        } catch (e) {
          console.error("Failed to check sala status before join", e);
        }
      }

      // ✅ Verificação para MÉDICO: bloquear sala inválida/cancelada/finalizada
      if (isMedicoUrl && roomName) {
        try {
          const salaRes = await fetch(`/api/fila/sala-status?roomName=${encodeURIComponent(roomName)}`);
          if (salaRes.ok) {
            const salaData = await salaRes.json();
            if (salaData.status === 'nao_encontrado') {
              toast.error("Esta sala não existe no sistema.");
              setIsConnecting(false);
              setTimeout(() => {
                window.location.href = "/medico/fila";
              }, 1500);
              return;
            }
            if (salaData.status === 'cancelado' || salaData.status === 'expirado') {
              toast.error("Esta sala foi cancelada.");
              setIsConnecting(false);
              setTimeout(() => {
                window.location.href = "/medico/fila";
              }, 1500);
              return;
            }
            if (salaData.status === 'finalizado') {
              toast.error("Esta consulta já foi finalizada.");
              setIsConnecting(false);
              setTimeout(() => {
                window.location.href = "/medico/fila";
              }, 1500);
              return;
            }
          }
        } catch (e) {
          console.error("Failed to check sala status for médico", e);
        }
      }

      // 1. Get ICE configuration
      const response = await fetch("/api/video/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity, room: roomName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao obter configuração");

      iceConfigRef.current = {
        iceServers: data.iceServers,
        signalingServerUrl: data.signalingServerUrl
      };

      // 2. Get local media
      console.log("Solicitando acesso à câmera e microfone...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } }, // Reduced resolution for mobile optimization
        audio: true
      });

      console.log("Acesso concedido! Tracks:", stream.getTracks().map(t => ({
        kind: t.kind,
        label: t.label,
        enabled: t.enabled,
        readyState: t.readyState
      })));

      localStreamRef.current = stream;

      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log("Stream de vídeo local configurado:", stream.getTracks());

        // Force play (importante para alguns navegadores)
        localVideoRef.current.play().catch(err => {
          console.error("Erro ao reproduzir vídeo local:", err);
        });
      }

      // 3. Connect to signaling server
      // Detecta automaticamente se está em produção baseado no hostname
      let signalingUrl = data.signalingServerUrl;

      // Se o hostname não for localhost, força uso do WSS de produção
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        signalingUrl = 'wss://ws.triagem.cliv.app';
      }

      console.log('Conectando ao servidor de sinalização:', signalingUrl);

      const socket = io(signalingUrl, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      socketRef.current = socket;

      // Socket event handlers
      socket.on("connect", () => {
        console.log("Conectado ao servidor de sinalização");
        socket.emit("join-room", { roomName, identity });

        // Broadcast initial media state
        setTimeout(() => {
          socket.emit("media-state", {
            to: null,
            isAudioEnabled: isAudioEnabledRef.current,
            isVideoEnabled: isVideoEnabledRef.current
          });
        }, 1000);
      });

      socket.on("transcription-status", ({ status }: { status: 'off' | 'recording' | 'processing' | 'completed' }) => {
        setRemoteTranscriptionStatus(status);
      });

      socket.on("existing-participants", (existingParticipants: Participant[]) => {
        console.log(`Participantes existentes: ${existingParticipants.length}`);
        existingParticipants.forEach(p => {
          createOffer(p.socketId, p.identity);
        });
      });

      socket.on("user-joined", ({ socketId, identity: userIdentity }: { socketId: string; identity: string }) => {
        console.log(`${userIdentity} entrou na sala`);
        toast.success(`${userIdentity} entrou na sala`);

        setParticipants(prev => {
          const updated = new Map(prev);
          updated.set(socketId, { socketId, identity: userIdentity });
          return updated;
        });

        // Send my media state to the new user
        socketRef.current?.emit("media-state", {
          to: socketId,
          isAudioEnabled: isAudioEnabledRef.current,
          isVideoEnabled: isVideoEnabledRef.current
        });
      });

      socket.on("offer", ({ from, offer, identity: fromIdentity }: { from: string; offer: RTCSessionDescriptionInit; identity: string }) => {
        handleOffer(from, offer, fromIdentity);
      });

      socket.on("answer", ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
        handleAnswer(from, answer);
      });

      socket.on("ice-candidate", ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
        handleIceCandidate(from, candidate);
      });

      socket.on("user-left", ({ socketId, identity: userIdentity }: { socketId: string; identity: string }) => {
        console.log(`${userIdentity} saiu da sala`);
        toast(`${userIdentity} saiu da sala`, { icon: "👋" });

        updateParticipantsMap(prev => {
          const updated = new Map(prev);
          const participant = updated.get(socketId);
          if (participant?.peerConnection) {
            participant.peerConnection.close();
          }
          updated.delete(socketId);
          return updated;
        });

        // If I'm the doctor and the patient left (not me), reset the -online flag so my 2-min countdown restarts
        const isMedicoNow = window.location.href.includes("medico=true");
        if (isMedicoNow && roomName) {
          fetch('/api/fila/paciente_saiu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName })
          }).catch(console.error);
        }
      });

      // 👉 Paciente recebe sinal de encerramento do médico e vai para a avaliação
      socket.on("call-ended", () => {
        const isMedicoNow = window.location.href.includes("medico=true");
        if (!isMedicoNow) {
          // Busca pacienteId e room da URL atual
          const urlParams = new URLSearchParams(window.location.search);
          const pid = urlParams.get("pacienteId") || "";
          const rm = urlParams.get("room") || "";
          toast("👨‍⚕️ Consulta encerrada pelo médico.");

          // Pequena pausa para o toast aparecer
          setTimeout(() => {
            const urlSafeRoom = encodeURIComponent(rm);
            const urlSafePid = encodeURIComponent(pid);
            window.location.href = `/teleconsulta/avaliacao?room=${urlSafeRoom}&pacienteId=${urlSafePid}`;
          }, 1200);
        }
      });

      socket.on("disconnect", () => {
        console.log("Desconectado do servidor de sinalização");
        setConnectionQuality("disconnected");
        toast.error("Conexão perdida com o servidor");
      });

      socket.on("media-state", ({ from, isAudioEnabled, isVideoEnabled }) => {
        console.log(`Atualização de mídia de ${from}: Audio=${isAudioEnabled}, Video=${isVideoEnabled}`);
        updateParticipantsMap(prev => {
          const updated = new Map(prev);
          const participant = updated.get(from);
          if (participant) {
            participant.isAudioEnabled = isAudioEnabled;
            participant.isVideoEnabled = isVideoEnabled;
            updated.set(from, participant);
          }
          return updated;
        });
      });

      socket.on("connect_error", (error) => {
        console.error("Erro de conexão:", error);
        toast.error("Erro ao conectar com o servidor");
        setIsConnecting(false);
      });

      setIsInRoom(true);
      setIsConnecting(false);
      toast.success(`Conectado à sala: ${roomName}`);

    } catch (err: any) {
      console.error(err);
      toast.error(`Falha ao conectar: ${err.message}`);
      setIsConnecting(false);
      setIsInRoom(false);
    }
  };

  // --- Controls ---

  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isAudioEnabled;
      });
      const newStatus = !isAudioEnabled;
      setIsAudioEnabled(newStatus);
      isAudioEnabledRef.current = newStatus; // Update Ref
      toast(newStatus ? "Microfone ativado 🎙️" : "Microfone desativado 🔇");

      socketRef.current?.emit("media-state", {
        to: null, // Broadcast to room
        isAudioEnabled: newStatus,
        isVideoEnabled: isVideoEnabled
      });
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      const newStatus = !isVideoEnabled;
      setIsVideoEnabled(newStatus);
      isVideoEnabledRef.current = newStatus; // Update Ref
      toast(newStatus ? "Câmera ativada 📹" : "Câmera desligada 🚫");

      socketRef.current?.emit("media-state", {
        to: null, // Broadcast to room
        isAudioEnabled: isAudioEnabled,
        isVideoEnabled: newStatus
      });
    }
  };

  const leaveRoom = async (fromRemote = false) => {
    // Determine dynamically from URL to avoid stale state closure in socket events
    const isMedicoUrl = window.location.href.includes("medico=true");
    const currentRoomName = roomName || '';

    // Se o médico estiver encerrando voluntariamente, avisa todos na sala imediatamente
    if (isMedicoUrl && !fromRemote) {
      // 1. Sinal via DataChannel (P2P - Mais rápido)
      const endPayload = JSON.stringify({ type: 'end-call' });
      participantsRef.current.forEach(p => {
        if (p.dataChannel && p.dataChannel.readyState === "open") {
          try { p.dataChannel.send(endPayload); } catch (e) { console.error(e); }
        }
      });

      // 2. Sinal via Socket (Broadcast do servidor)
      if (socketRef.current?.connected) {
        socketRef.current.emit("call-ended", { roomName: currentRoomName });
      }
    }

    // Tenta finalizar o status na API se for médico
    if (isMedicoUrl && pacienteId) {
      try {
        // Não esperamos o fetch para não atrasar a saída da sala local
        fetch('/api/fila/status', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pacienteId, novoStatus: 'finalizado' })
        }).catch(e => console.warn("Erro ao finalizar status:", e));
      } catch (e) {
        console.warn("Erro ao encerrar consulta na API:", e);
      }
    } else if (!isMedicoUrl && currentRoomName && !fromRemote) {
      // Patient leaving voluntarily – reset the -online flag so doctor's 2-min timer restarts
      try {
        fetch('/api/fila/paciente_saiu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName: currentRoomName })
        }).catch(console.error);
      } catch (e) {
        console.warn("Erro ao notificar paciente saiu:", e);
      }
    }

    // Close all peer connections
    participantsRef.current.forEach(participant => {
      participant.peerConnection?.close();
    });

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsInRoom(false);
    setIsCallEnded(true);
    updateParticipantsMap(() => new Map());
    setConnectionQuality("good");

    if (isMedicoUrl) {
      router.push("/medico/fila");
      window.location.href = "/medico/fila";
    } else {
      if (fromRemote) {
        const urlSafeRoom = encodeURIComponent(roomName || '');
        const urlSafePid = encodeURIComponent(pacienteId || '');
        router.push(`/teleconsulta/avaliacao?room=${urlSafeRoom}&pacienteId=${urlSafePid}`);
        window.location.href = `/teleconsulta/avaliacao?room=${urlSafeRoom}&pacienteId=${urlSafePid}`;
      } else {
        router.push("/");
        window.location.href = "/";
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Erro ao ativar tela cheia: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleSendDocument = (docType: DocumentType, content: string, extraData?: any) => {
    const payload = JSON.stringify({ type: 'document', docType, content, extraData });

    // Envia para todos na sala
    participantsRef.current.forEach(p => {
      if (p.dataChannel && p.dataChannel.readyState === "open") {
        try {
          p.dataChannel.send(payload);
        } catch (e) {
          console.error("Erro ao enviar via DataChannel:", e);
        }
      }
    });

    // Adiciona no próprio chat para histórico
    setTranscriptions(prev => [...prev, {
      sender: "Você",
      text: content,
      isDocument: true,
      docType,
      extraData
    }]);

    setShowChat(true);
    toast.success(`${docType} emitido(a) com sucesso!`);

    // Se for uma Receita, extrai os medicamentos para uso no tratamento
    if (docType === "Receita" && extraData?.medicamentos) {
      setMedicamentosDaReceita(extraData.medicamentos);
    } else if (docType === "Receita" && content) {
      // Tenta extrair medicamentos do texto da receita
      const linhas = content.split('\n').filter((l: string) => l.trim().startsWith('-'));
      const meds = linhas.map((l: string) => {
        // Regex corrigido: captura o nome inteiro antes do parêntese ou dash
        const match = l.match(/^-\s+(.+?)(?:\s*\(([^)]+)\))?(?:\s*-\s*Qtd:\s*(.+))?$/);
        if (match) {
          return { nome: match[1].trim(), dosagem: match[2] || "", quantidade: match[3] || "" };
        }
        return null;
      }).filter(Boolean);
      if (meds.length > 0) setMedicamentosDaReceita(meds);
    }
  };

  // --- Render Call Ended ---
  if (isCallEnded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
        <h1 className="text-2xl font-bold">Encerrando consulta...</h1>
        <p className="text-gray-400 mt-2">Redirecionando você.</p>
      </div>
    );
  }

  // --- Render Lobby ---
  if (!isInRoom) {
    if (autoJoinAttempted && roomName && identity) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
          <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
          <p className="text-xl font-medium animate-pulse">Conectando à sala...</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-800 p-4">
        <Toaster />
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-cyan-100 rounded-full">
              <VideoIcon className="w-10 h-10 text-cyan-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">Teleconsulta</h1>
          <p className="text-center text-gray-500 mb-8">Entre na sala para iniciar o atendimento.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seu Nome</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition"
                placeholder="Ex: Dr. Silva ou Maria"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Sala</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition"
                placeholder="Ex: Consultorio-01"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
              />
            </div>

            <button
              onClick={joinRoom}
              disabled={isConnecting}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 mt-4 shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Conectando...
                </>
              ) : (
                <>Entrar na Sala</>
              )}
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Render Active Room ---
  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <div className="flex-1 flex flex-col relative w-full h-full">
        <Toaster />
        <header className="px-6 py-4 bg-gray-800 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${connectionQuality === "good" ? "bg-green-500" :
              connectionQuality === "poor" ? "bg-yellow-500" : "bg-red-500"
              }`}></div>
            <h2 className="font-semibold text-lg">Consulta</h2>
          </div>
          <div className="flex items-center gap-4">
            {/* Layout Toggle */}
            <button
              onClick={() => setViewMode(prev => prev === 'grid' ? 'spotlight' : 'grid')}
              className="p-2 rounded-full hover:bg-gray-700 transition-colors"
              title={viewMode === 'grid' ? "Mudar para modo Destaque" : "Mudar para modo Grade"}
            >
              <LayoutGrid className={`w-5 h-5 ${viewMode === 'spotlight' ? 'text-cyan-400' : 'text-gray-400'}`} />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full hover:bg-gray-700 transition-colors"
              title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            >
              {isFullscreen ? <Minimize className="w-5 h-5 text-gray-400" /> : <Maximize className="w-5 h-5 text-gray-400" />}
            </button>

            <div className="h-6 w-px bg-gray-700 mx-2"></div>

            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Users className="w-4 h-4" />
              <span>{participants.size + 1}</span>
            </div>
            {connectionQuality === "good" ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
          </div>
        </header>

        <main className={`flex-1 relative ${viewMode === 'spotlight' ? 'bg-black overflow-hidden' : 'p-4 overflow-y-auto'}`}>
          {/* Status de Transcrição para o Paciente */}
          {!isMedico && remoteTranscriptionStatus !== 'off' && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-xl ${
                remoteTranscriptionStatus === 'recording' 
                  ? "bg-red-600/30 border-red-500/50 text-white" 
                  : "bg-cyan-600/30 border-cyan-500/50 text-white"
              }`}>
                {remoteTranscriptionStatus === 'recording' ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                    <span className="font-bold text-sm tracking-wide">O médico iniciou a gravação...</span>
                  </>
                ) : remoteTranscriptionStatus === 'processing' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span className="font-medium text-sm tracking-wide">O médico está transcrevendo esta consulta de forma automática</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-sm tracking-wide text-emerald-100">Transcrição finalizada. Revisando dados...</span>
                  </>
                )}
              </div>
            </div>
          )}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full content-center">
              {/* Local Video (Grid) */}
              <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-700 aspect-video flex-1 min-w-[300px] group">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
                <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-md text-sm font-medium backdrop-blur-sm flex items-center gap-2">
                  <span>Você {identity && `(${identity})`}</span>
                  {!isAudioEnabled && <MicOff className="w-3 h-3 text-red-400" />}
                </div>
                {!isVideoEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800/90 z-10">
                    <div className="flex flex-col items-center text-gray-400">
                      <VideoOff className="w-12 h-12 mb-2" />
                      <span>Câmera desligada</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Remote Videos (Grid) */}
              {Array.from(participants.values()).map((participant) => (
                <div
                  key={participant.socketId}
                  className="relative bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-700 aspect-video flex-1 min-w-[300px]"
                >
                  {participant.stream ? (
                    <video
                      autoPlay
                      playsInline
                      ref={(el) => {
                        if (el && participant.stream) {
                          if (el.srcObject !== participant.stream) {
                            el.srcObject = participant.stream;
                            el.play().catch(e => console.error(e));
                          }
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <div className="animate-pulse mb-2">Conectando...</div>
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-md text-sm font-medium backdrop-blur-sm flex items-center gap-2">
                    <span>{participant.identity}</span>
                    {participant.isAudioEnabled === false && <MicOff className="w-3 h-3 text-red-400" />}
                  </div>

                  {/* Placeholder Camera Off Remoto */}
                  {participant.isVideoEnabled === false && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800/90 z-10">
                      <div className="flex flex-col items-center text-gray-400">
                        <VideoOff className="w-12 h-12 mb-2" />
                        <span>Câmera desligada</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Spotlight Mode (WhatsApp Style)
            <div className="w-full h-full relative">
              {/* MAIN VIDEO LAYER */}
              {focusedUser === 'remote' ? (
                // Main: Remote
                participants.size > 0 ? (
                  (() => {
                    const participant = Array.from(participants.values())[0];
                    return (
                      <div key={`main-remote-${participant.socketId}`} className="absolute inset-0 w-full h-full bg-black">
                        {participant.stream ? (
                          <video
                            autoPlay
                            playsInline
                            ref={(el) => {
                              if (el && participant.stream && el.srcObject !== participant.stream) {
                                el.srcObject = participant.stream;
                                el.play().catch(console.error);
                              }
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <span className="animate-pulse">Conectando vídeo...</span>
                          </div>
                        )}
                        <div className="absolute top-4 left-4 bg-black/60 px-4 py-2 rounded-lg text-lg font-medium backdrop-blur-sm shadow-lg flex items-center gap-2">
                          {participant.identity}
                          {participant.isAudioEnabled === false && <MicOff className="w-4 h-4 text-red-400" />}
                        </div>
                        {participant.isVideoEnabled === false && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 z-10">
                            <div className="flex flex-col items-center text-gray-400">
                              <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                <span className="text-3xl font-bold text-gray-500">{participant.identity.charAt(0).toUpperCase()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <VideoOff className="w-6 h-6" />
                                <span className="text-xl">Câmera desligada</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                    <p>Aguardando participantes...</p>
                  </div>
                )
              ) : (
                // Main: Local
                <div key="main-local" className="absolute inset-0 w-full h-full bg-black group">
                  <video
                    ref={(el) => {
                      if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
                        el.srcObject = localStreamRef.current;
                        el.play().catch(() => {}); // Silently catch abort errors
                      }
                    }}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                  <div className="absolute top-4 left-4 bg-black/60 px-4 py-2 rounded-lg text-lg font-medium backdrop-blur-sm shadow-lg flex items-center gap-2 z-20">
                    Você
                    {!isAudioEnabled && <MicOff className="w-4 h-4 text-red-400" />}
                  </div>
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 z-10">
                      <div className="flex flex-col items-center text-gray-400">
                        <VideoOff className="w-16 h-16 mb-4" />
                        <span className="text-2xl">Câmera desligada</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PiP LAYER (Clickable to Swap) */}
              <div
                className="absolute bottom-6 right-6 w-40 md:w-56 aspect-[3/4] md:aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border-2 border-gray-800 z-30 transition-all hover:scale-105 cursor-pointer hover:border-cyan-500"
                onClick={() => setFocusedUser(prev => prev === 'local' ? 'remote' : 'local')}
                title="Clique para trocar"
              >
                {focusedUser === 'remote' ? (
                  // PiP: Local
                  <div className="w-full h-full relative">
                    <video
                      ref={(el) => {
                        if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
                          el.srcObject = localStreamRef.current;
                          el.play().catch(() => {});
                        }
                      }}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover transform scale-x-[-1]"
                    />
                    <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end z-20">
                      <span className="text-xs font-medium text-white/90 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm">Você</span>
                      {!isAudioEnabled && <MicOff className="w-3 h-3 text-red-500 drop-shadow-md" />}
                    </div>
                    {!isVideoEnabled && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-800/90 z-10">
                        <VideoOff className="w-8 h-8 text-gray-500" />
                      </div>
                    )}
                  </div>
                ) : (
                  // PiP: Remote
                  participants.size > 0 ? (
                    (() => {
                      const participant = Array.from(participants.values())[0];
                      return (
                        <div key={`pip-remote-${participant.socketId}`} className="w-full h-full relative">
                          {participant.stream ? (
                            <video
                              autoPlay
                              playsInline
                              ref={(el) => {
                                if (el && participant.stream && el.srcObject !== participant.stream) {
                                  el.srcObject = participant.stream;
                                  el.play().catch(() => {});
                                }
                              }}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-900">
                              <Users className="w-6 h-6 text-gray-600 animate-pulse" />
                            </div>
                          )}
                          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end z-20">
                            <span className="text-xs font-medium text-white/90 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm truncate max-w-[80%]">{participant.identity}</span>
                            {participant.isAudioEnabled === false && <MicOff className="w-3 h-3 text-red-500" />}
                          </div>
                          {participant.isVideoEnabled === false && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-800/90 z-10">
                              <VideoOff className="w-8 h-8 text-gray-500" />
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-500">
                      <Users className="w-8 h-8" />
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </main>

        {/* LINHA DO TEMPO — painel inferior, largura total, 35% de altura, scroll interno */}
        {showChat && (
          <div className="w-full h-[35vh] bg-gray-800 border-t border-gray-700 flex flex-col flex-shrink-0">
            <div className="px-4 py-2 bg-gray-900 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
              <h3 className="font-bold flex items-center gap-2 text-sm">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span>Linha do Tempo da Consulta</span>
                <span className="text-xs text-gray-400 font-normal">(transcrição automática)</span>
              </h3>
              <button
                onClick={() => setShowChat(false)}
                className="text-gray-400 hover:text-white text-xl leading-none"
                title="Fechar"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {transcriptions.map((msg, idx) => {
                const fromMe = msg.sender === identity || msg.sender === "Você";

                if (msg.isDocument) {
                  return (
                    <div key={idx} className={`flex flex-col ${fromMe ? "items-end" : "items-start"}`}>
                      <span className="text-[10px] text-gray-400 mb-0.5">{msg.sender} compartilhou um documento</span>
                      <div className={`w-full max-w-[280px] rounded-lg shadow-md overflow-hidden ${fromMe ? "bg-cyan-900 border border-cyan-700" : "bg-gray-700 border border-gray-600"}`}>
                        <div className={`p-3 border-b flex items-center gap-2 ${fromMe ? "border-cyan-800 bg-cyan-800/50" : "border-gray-600 bg-gray-600/50"}`}>
                          <FileText className={`w-5 h-5 ${fromMe ? "text-cyan-400" : "text-gray-300"}`} />
                          <span className="font-semibold text-sm">{msg.docType}</span>
                        </div>
                        <div className="p-3">
                          <p className="text-xs text-gray-300 line-clamp-3 mb-3 italic">"{msg.text}"</p>
                          <button
                            onClick={() => {
                              const doctorName = fromMe ? (msg.sender === "Você" ? identity : msg.sender) : msg.sender;
                              const pName = fromMe ? (msg.extraData?.patientInfo?.nome || "Paciente") : identity;

                              generatePdfTeleconsulta(
                                msg.docType as any,
                                msg.text,
                                doctorName,
                                msg.extraData?.patientInfo || { nome: pName },
                                msg.extraData?.unitConfig,
                                msg.extraData?.professionalConfig?.assinatura_url
                              ).then(() => toast.success("Download iniciado"))
                                .catch(() => toast.error("Erro ao gerar PDF"));
                            }}
                            className={`w-full py-2 px-3 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors ${fromMe
                              ? "bg-cyan-700 hover:bg-cyan-600 text-white"
                              : "bg-gray-600 hover:bg-gray-500 text-white"
                              }`}
                          >
                            <Download className="w-4 h-4" /> Baixar PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} className={`flex flex-col ${fromMe ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] text-gray-400 mb-0.5">{msg.sender}</span>
                    <div className={`px-3 py-2 rounded-lg text-sm max-w-[85%] shadow-sm ${fromMe ? "bg-cyan-700 text-white rounded-br-none" : "bg-gray-700 text-gray-100 rounded-bl-none"}`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}

              {transcriptions.length === 0 && (
                <p className="text-gray-500 text-sm text-center italic mt-8">
                  A transcrição de voz irá aparecer aqui automaticamente durante a consulta.
                </p>
              )}
            </div>
          </div>
        )}

        <footer className="py-6 bg-gray-800 flex justify-center gap-6 shadow-[0_-5px_15px_rgba(0,0,0,0.3)] z-20">
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full transition-all duration-300 shadow-lg ${isAudioEnabled
              ? "bg-gray-700 hover:bg-gray-600 text-white"
              : "bg-red-500 hover:bg-red-600 text-white ring-2 ring-red-400/50"
              }`}
            title={isAudioEnabled ? "Mutar microfone" : "Ativar microfone"}
          >
            {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-all duration-300 shadow-lg ${isVideoEnabled
              ? "bg-gray-700 hover:bg-gray-600 text-white"
              : "bg-red-500 hover:bg-red-600 text-white ring-2 ring-red-400/50"
              }`}
            title={isVideoEnabled ? "Desligar câmera" : "Ligar câmera"}
          >
            {isVideoEnabled ? <VideoIcon className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>

          {isMedico ? (
            <button
              onClick={() => setShowAcoesModal(true)}
              className="p-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all duration-300 ring-2 ring-emerald-500/30"
              title="Ações da Consulta"
            >
              <Plus className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={() => {
                setShowChat(!showChat);
                if (!isTranscribing && !showChat) {
                  toggleTranscription();
                }
              }}
              className={`p-4 rounded-full transition-all duration-300 shadow-lg ${showChat || isTranscribing
                ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-white"
                }`}
              title="Transcrição de Áudio (Chat)"
            >
              <MessageSquare className="w-6 h-6" />
            </button>
          )}

          {isMedico && (
            <button
              onClick={() => leaveRoom(false)}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-all duration-300 hover:scale-110"
              title="Encerrar chamada"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          )}
        </footer>
      </div >

      <AIReviewModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        pacienteId={pacienteId}
        aiResult={aiResult}
      />

      <DocumentoTeleconsultaModal
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
        onSend={handleSendDocument}
        pacienteId={pacienteId}
      />

      <AcoesConsultaModal
        isOpen={showAcoesModal}
        onClose={() => setShowAcoesModal(false)}
        onOpenProntuario={() => setShowProntuarioModal(true)}
        onOpenDocumentos={() => setShowDocModal(true)}
        onOpenTratamento={() => setShowTratamentoModal(true)}
        onOpenCondicao={() => setShowCondicaoModal(true)}
        isRecording={isRecording}
        isProcessingAI={isProcessingAI}
        onToggleRecording={isRecording ? stopRecording : startRecording}
        onOpenChat={() => {
          setShowChat(true);
          if (!isTranscribing) toggleTranscription();
        }}
      />

      <ProntuarioModal
        isOpen={showProntuarioModal}
        onClose={() => setShowProntuarioModal(false)}
        pacienteId={pacienteId}
      />

      <TratamentoModal
        isOpen={showTratamentoModal}
        onClose={() => setShowTratamentoModal(false)}
        pacienteId={pacienteId}
        medicamentosDaReceita={medicamentosDaReceita}
      />

      <CondicaoModal
        isOpen={showCondicaoModal}
        onClose={() => setShowCondicaoModal(false)}
        pacienteId={pacienteId}
      />
    </div >
  );
}
