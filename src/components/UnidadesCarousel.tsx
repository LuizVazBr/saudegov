import React from "react";
import { FiMapPin, FiNavigation, FiPlayCircle, FiVolume2, FiImage, FiPause } from "react-icons/fi";

interface Unidade {
    id: string;
    nome: string;
    tipo: "UBS" | "UPA";
    endereco: string;
    lat: number;
    lng: number;
    videoUrl?: string; // URL opcional do vídeo
    imgUrl?: string; // Nova propriedade para imagem
    audioUrl?: string; // URL opcional do áudio
    distanciaKm?: string | null;
}

interface UnidadesCarouselProps {
    unidades: Unidade[];
    onSelect: (unidade: Unidade) => void;
    onWatchVideo: (unidade: Unidade) => void;
    onPlayAudio: (unidade: Unidade) => void; // Novo prop
    playingUrl?: string | null;
    isPlaying?: boolean;
    tema: any;
}

export default function UnidadesCarousel({ unidades, onSelect, onWatchVideo, onPlayAudio, playingUrl, isPlaying, tema }: UnidadesCarouselProps) {
    if (!unidades || unidades.length === 0) return null;

    const unitIsPlaying = (current: string | null | undefined, unitUrl: string | undefined) => {
        if (!current || !unitUrl) return false;
        return current.endsWith(unitUrl) || current === unitUrl;
    }

    return (
        <div className={`w-full px-5 mt-6 mb-2`}>
            <h2 className={`text-lg font-semibold mb-1 ${tema.textPrimary}`}>Unidades disponíveis</h2>
            <p className={`text-xs ${tema.textSecondary} mb-3`}>Encontre a unidade mais próxima de você</p>
            <div className="flex overflow-x-auto space-x-4 pb-4 scrollbar-hide snap-x">
                {unidades.map((unidade) => (
                    <div
                        key={unidade.id}
                        className={`flex-none w-72 p-4 rounded-xl border ${tema.borderColor} ${tema.cardBg} shadow-sm snap-center hover:shadow-md transition text-left flex flex-col justify-between`}
                    >
                        {/* Imagem do local */}
                        <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 rounded-lg mb-3 overflow-hidden relative flex items-center justify-center">
                            {unidade.imgUrl ? (
                                <img
                                    src={unidade.imgUrl}
                                    alt={unidade.nome}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                                    <FiImage size={32} />
                                    <span className="text-xs mt-1">Sem imagem</span>
                                </div>
                            )}

                            {/* Botão de Áudio (Só aparece se tiver audioUrl) */}
                            {unidade.audioUrl && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPlayAudio(unidade);
                                    }}
                                    className="absolute top-2 right-2 p-2 bg-white/90 rounded-full text-gray-800 hover:bg-white transition shadow-sm z-10"
                                    title="Ouvir resumo"
                                >
                                    {playingUrl && unitIsPlaying(playingUrl, unidade.audioUrl) ? (
                                        isPlaying ? (
                                            <FiPause size={18} className="text-blue-600" />
                                        ) : (
                                            <FiPlayCircle size={18} className="text-blue-600" />
                                        )
                                    ) : (
                                        <FiVolume2 size={18} />
                                    )}
                                </button>
                            )}

                            {/* Badge de distância */}
                            {unidade.distanciaKm && (
                                <div className="absolute bottom-2 left-2 px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded flex items-center shadow-lg">
                                    <FiNavigation size={10} className="mr-1" />
                                    {unidade.distanciaKm} km
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <span className={`px-2 py-1 text-xs font-bold rounded ${unidade.tipo === "UPA"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                    : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                    }`}>
                                    {unidade.tipo}
                                </span>
                            </div>
                            <h3 className={`font-bold text-lg mb-1 ${tema.textPrimary} line-clamp-1`}>{unidade.nome}</h3>
                            <p className={`text-sm ${tema.textSecondary} line-clamp-2 leading-tight`}>
                                {unidade.endereco}
                            </p>
                        </div>

                        <div className="mt-4 flex flex-col gap-3">
                            <button
                                onClick={() => onSelect(unidade)}
                                className={`flex items-center justify-center w-full py-2 px-4 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold text-sm hover:bg-blue-100 transition`}
                            >
                                <FiMapPin className="mr-2" size={16} />
                                VER NO MAPA
                            </button>

                            {/* Botão de Vídeo (Só aparece se tiver videoUrl) */}
                            {unidade.videoUrl && (
                                <button
                                    onClick={() => onWatchVideo(unidade)}
                                    className={`flex items-center justify-center w-full py-2 px-4 rounded-lg bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300 font-semibold text-sm hover:bg-gray-200 transition`}
                                >
                                    <FiPlayCircle className="mr-2" size={16} />
                                    ASSISTIR VÍDEO
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
