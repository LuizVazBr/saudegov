import React from "react";
import BottomSheetModal from "./BottomSheetModal";
import { FiX } from "react-icons/fi";

interface VideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    videoUrl?: string;
    titulo?: string;
    tema: any;
}

export default function VideoModal({ isOpen, onClose, videoUrl, titulo, tema }: VideoModalProps) {
    if (!isOpen) return null;

    return (
        <BottomSheetModal isOpen={isOpen} onClose={onClose}>
            <div className="flex justify-between items-center mb-4">
                <h2 className={`text-xl font-semibold ${tema.textPrimary}`}>
                    {titulo || "Vídeo da Unidade"}
                </h2>
                <button
                    onClick={onClose}
                    className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                    <FiX size={24} className={tema.textPrimary} />
                </button>
            </div>

            <div className="w-full h-[350px] bg-black rounded-lg overflow-hidden relative">
                {videoUrl ? (
                    videoUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                        <video
                            src={videoUrl}
                            className="w-full h-full object-contain"
                            controls
                            playsInline
                        />
                    ) : (
                        <iframe
                            width="100%"
                            height="100%"
                            src={videoUrl}
                            title={titulo || "Vídeo"}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        ></iframe>
                    )
                ) : (
                    <div className="flex items-center justify-center h-full text-white">
                        <p>Vídeo indisponível</p>
                    </div>
                )}
            </div>
        </BottomSheetModal>
    );
}
