"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { FiHeadphones } from "react-icons/fi";
import { safeStorage } from "@/lib/storage";

interface Tema {
  toastBg: string;
  toastText: string;
}

export function useAudioPlayer(tema: Tema) {
  const [audioHabilitado, setAudioHabilitado] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = safeStorage.getItem("audioHabilitado");
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resultadoRef = useRef<HTMLAudioElement | null>(null);

  // Inicializa áudios
  useEffect(() => {
    const audio = new Audio();
    audio.loop = false;
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setCurrentUrl(null);
    });
    audioRef.current = audio;

    const audioResultado = new Audio("/audio-resultado.mp3");
    audioResultado.loop = false;
    resultadoRef.current = audioResultado;

    return () => {
      [audio, audioResultado].forEach(a => {
        a.pause();
        a.currentTime = 0;
      });
      audio.removeEventListener("ended", () => {
        setIsPlaying(false);
        setCurrentUrl(null);
      });
    };
  }, []);

  const mostrarToastAudio = (msg: string = "Áudio iniciando, aumente o volume para ouvir") => {
    toast((t) => (
      <div className="flex items-center justify-between space-x-4">
        <div className="flex items-center space-x-2">
          <FiHeadphones size={20} />
          <span>{msg}</span>
        </div>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="ml-4 px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold"
        >
          OK
        </button>
      </div>
    ), {
      style: { borderRadius: '8px', background: tema.toastBg, color: tema.toastText },
      duration: 3000,
    });
  };

  const tocarAudio = (src: string) => {
    if (!audioHabilitado || !audioRef.current) return;

    // Lógica Toggle/Resume
    // Verifica se é a mesma URL (fim da string ou exata)
    const isSame = audioRef.current.src.endsWith(src) || audioRef.current.src === src;

    if (isSame && currentUrl) {
      if (audioRef.current.paused) {
        audioRef.current.play();
        setIsPlaying(true);
        mostrarToastAudio("Áudio retomado");
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
        mostrarToastAudio("Áudio pausado");
      }
    } else {
      // Novo áudio
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = src;
      audioRef.current.play().catch(e => console.error("Erro ao tocar:", e));
      setIsPlaying(true);
      setCurrentUrl(src);
      mostrarToastAudio("Áudio iniciando");
    }
  };

  const tocarAudioResultado = () => {
    if (!audioHabilitado || !resultadoRef.current) return;

    resultadoRef.current.pause();
    resultadoRef.current.currentTime = 0;
    resultadoRef.current.play().catch(e => console.error(e));
    setIsPlaying(true);

    mostrarToastAudio("Áudio de resultado iniciado");
  };

  const togglePlay = () => {
    // Tocar áudio padrão /audio1.mp3 com toggle
    if (!audioRef.current || !audioHabilitado) return;

    // Se estiver tocando audio1, pausa. Se estiver tocando outro, troca.
    const isAudio1 = audioRef.current.src.endsWith("/audio1.mp3");

    if (isPlaying && isAudio1) {
      audioRef.current.pause();
      setIsPlaying(false);
      mostrarToastAudio("Áudio pausado");
    } else {
      tocarAudio("/audio1.mp3");
    }
  };

  const toggleAudio = () => {
    const novo = !audioHabilitado;
    setAudioHabilitado(novo);
    safeStorage.setItem("audioHabilitado", JSON.stringify(novo));

    toast((t) => (
      <div className="flex items-center justify-between space-x-4">
        <span>{novo ? "Áudio habilitado" : "Áudio desabilitado"}</span>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="ml-4 px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold"
        >
          OK
        </button>
      </div>
    ), {
      style: { borderRadius: '8px', background: tema.toastBg, color: tema.toastText },
      duration: 3000,
    });
  };

  const tocarInstrucoes = () => {
    if (!audioHabilitado) return;
    const jaEscutou = safeStorage.getItem("jaEscutouInstrucoesAudio");
    if (!jaEscutou) {
      tocarAudio("/audio2.mp3");
      safeStorage.setItem("jaEscutouInstrucoesAudio", "true");
    }
  };

  const tocarAudioLigacao = () => {
    if (!audioHabilitado) return;
    const tocouAntes = safeStorage.getItem("audioLigacaoTocado");
    if (!tocouAntes) {
      tocarAudio("/audio4.mp3");
      safeStorage.setItem("audioLigacaoTocado", "true");
    }
  };

  const pararAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (resultadoRef.current) {
      resultadoRef.current.pause();
      resultadoRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentUrl(null);
  };

  return {
    audioHabilitado,
    toggleAudio,
    isPlaying,
    currentUrl,
    togglePlay,
    tocarInstrucoes,
    tocarAudioLigacao,
    tocarAudioResultado,
    tocarAudio,
    pararAudio
  };
}
