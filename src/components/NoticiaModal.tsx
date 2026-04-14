import React, { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import BottomSheetModal from "./BottomSheetModal";
import { motion, AnimatePresence } from "framer-motion";

interface Slide {
  texto?: string;
  imagem?: string;
  tempo?: number; // tempo específico deste slide
}

interface Noticia {
  id: string;
  titulo: string;
  slides: Slide[];
  audio?: string;
  autoPlay?: boolean;
}

interface NoticiaModalProps {
  isOpen: boolean;
  onClose: () => void;
  noticia: Noticia;
}

export default function NoticiaModal({ isOpen, onClose, noticia }: NoticiaModalProps) {
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    setSlideIndex(0); // reset ao abrir nova notícia
  }, [noticia]);

  // autoplay de acordo com cada slide
  useEffect(() => {
    if (!noticia.autoPlay) return;

    const tempoAtual = noticia.slides[slideIndex]?.tempo ?? 5; // default 5s
    const timer = setTimeout(() => {
      if (slideIndex < noticia.slides.length - 1) setSlideIndex(slideIndex + 1);
    }, tempoAtual * 1000);

    return () => clearTimeout(timer);
  }, [slideIndex, noticia]);

  const proximoSlide = () => {
    if (slideIndex < noticia.slides.length - 1) setSlideIndex(slideIndex + 1);
  };

  const slideAnterior = () => {
    if (slideIndex > 0) setSlideIndex(slideIndex - 1);
  };

  const slide = noticia.slides[slideIndex];

  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose}>
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{noticia.titulo}</h2>
        <button onClick={onClose} className="p-2 mb-10">
          <FiX size={24} />
        </button>
      </div>

      {/* Conteúdo com rolagem apenas vertical */}
      <div className="min-h-[50vh] max-h-[50vh] overflow-y-auto overflow-x-hidden px-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={slideIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="pb-4"
          >
            {slide.imagem && (
              <img
                src={slide.imagem}
                className="w-full max-w-full h-48 object-cover rounded-lg mb-4"
              />
            )}
            {slide.texto && (
              <p className="text-gray-700 whitespace-pre-line">{slide.texto}</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navegação fixa */}
      <div className="flex justify-between items-center mt-4 pt-3 border-t">
        <button
          onClick={slideAnterior}
          disabled={slideIndex === 0}
          className="text-gray-500 disabled:opacity-30"
        >
          ◀ Anterior
        </button>
        <button
          onClick={proximoSlide}
          disabled={slideIndex === noticia.slides.length - 1}
          className="text-gray-500 disabled:opacity-30"
        >
          Próximo ▶
        </button>
      </div>
    </BottomSheetModal>
  );
}
