"use client";

import { useState, useEffect, useRef } from "react";
import { FiVolume2, FiPause } from "react-icons/fi";
import HeaderIn from "./HeaderIn";
import NoticiaModal from "./NoticiaModal";
import { useTheme } from "./ThemeProvider";
import { Session } from "next-auth";

interface Slide {
  texto?: string;
  imagem?: string;
  tempo?: number; // tempo específico deste slide em segundos
}

interface Noticia {
  id: string;
  titulo: string;
  slides: Slide[];
  audio?: string;
  nova?: boolean;
  autoPlay?: boolean; // define se a notícia toca automaticamente
}

interface ClientNoticiasProps {
  sessionServer: Session;
}

export default function ClientNoticias({ sessionServer }: ClientNoticiasProps) {
  const { tema } = useTheme();
  const [noticias, setNoticias] = useState<Noticia[]>([]);

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [noticiaIndex, setNoticiaIndex] = useState<number | null>(null);

  // Áudio
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchNoticias = async () => {
      const data: Noticia[] = [
        {
          id: "1",
          titulo: "Dor, inchaço ou veias endurecidas? Pode ser trombose!",
          slides: [
            { 
                imagem: "/noticia.png", 
                texto: `Muitas pessoas não percebem até que seja tarde.
                Descubra os sinais, riscos e como se proteger.

                1 em cada mil pessoas desenvolve trombose por ano no Brasil.
                Mais de 60% dos casos acontecem em pessoas acima de 60 anos.
                Uma das principais causas de complicações é após cirurgias ou longos períodos de internação.`, 
                tempo: 14 
            },
            { 
                texto: `Atenção aos sinais!

                - Inchaço em uma perna; dor ou sensibilidade localizada;

                - Calor e vermelhidão na região;

                - Veias mais visíveis e endurecidas.`, 
                tempo: 10
            },
            { 
                texto: `Quem está mais propenso?

                Pessoas que:
                - Passam longos períodos sentados ou deitados;
                - Passam por cirurgias ou internações prolongadas;
                - Fazem uso de anticoncepcionais ou reposição hormonal;
                - Com histórico familiar de trombose.`, 
                tempo: 10 
            },
            { 
                texto: `Como a trombose é tratada?

                O tratamento envolve anticoagulantes, meias de compressão e, quando necessário, procedimentos médicos especializados. Sempre com acompanhamento profissional.`, 
                tempo: 12 
            },
            { 
                texto: `Como reduzir o risco?

                - Movimente-se com frequência;
                - Pratique atividade física regular;
                - Beba bastante água;
                - Evite fumar;
                - Siga sempre orientações médicas em viagens longas ou após cirurgias.

                A informação é sua maior aliada na prevenção!`, 
                tempo: 10 
            },
          ],
          audio: "/audios/noticia1.wav",
          nova: true,
          autoPlay: true
        },
        /*{
          id: "2",
          titulo: "Campanha de vacinação começa amanhã",
          slides: [
            { imagem: "/noticia.png", texto: "Primeiro slide da vacinação", tempo: 5 },
            { texto: "Segundo slide com instruções...", tempo: 7 },
          ],
          audio: "/audio2.mp3",
          autoPlay: false
        },*/
      ];
      setNoticias(data);
    };
    fetchNoticias();
  }, []);

  const abrirModalNoticia = (index: number) => {
    setNoticiaIndex(index);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setNoticiaIndex(null);
  };

  const toggleAudio = (noticia: Noticia, e: React.MouseEvent) => {
    e.stopPropagation();

    if (currentAudioId === noticia.id) {
      if (audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play();
          setIsPlaying(true);
        } else {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      }
    } else {
      if (audioRef.current) audioRef.current.pause();

      audioRef.current = new Audio(noticia.audio);
      audioRef.current.play();
      setCurrentAudioId(noticia.id);
      setIsPlaying(true);

      audioRef.current.onended = () => {
        setCurrentAudioId(null);
        setIsPlaying(false);
      };
    }
  };

  return (
    <main className={`${tema.mainBg} min-h-screen`}>
      <HeaderIn paginaAtiva="noticias" tipoU="" sessionServer={sessionServer} />

      <div className="px-5 mt-6">
        <h1 className="text-2xl font-bold text-black dark:text-gray-300 mb-1">Notícias</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">Fique por dentro das novidades.</p>

        <div className="space-y-4">
          {noticias.map((n, i) => (
            <div
              key={n.id}
              className={`flex flex-col cursor-pointer rounded-xl p-3 ${tema.cardBg} border ${tema.borderColor} hover:shadow`}
              onClick={() => abrirModalNoticia(i)}
            >
              <div className="flex items-center space-x-4">
                {n.slides[0]?.imagem && (
                  <img src={n.slides[0].imagem} alt={n.titulo} className="w-20 h-20 object-cover rounded-lg" />
                )}
                <p className="font-bold flex-1 text-sm dark:text-gray-300">{n.titulo}</p>

                {n.nova && (
                  <span className="ml-2 inline-block px-2 py-1 text-xs font-bold text-white bg-red-500 rounded-full">
                    Nova
                  </span>
                )}

                {n.audio && (
                  <button onClick={(e) => toggleAudio(n, e)} className="ml-auto text-blue-600">
                    {currentAudioId === n.id && isPlaying ? <FiPause size={20} /> : <FiVolume2 size={20} />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {noticiaIndex !== null && (
        <NoticiaModal
          isOpen={modalAberto}
          onClose={fecharModal}
          noticia={noticias[noticiaIndex]}
        />
      )}
    </main>
  );
}
