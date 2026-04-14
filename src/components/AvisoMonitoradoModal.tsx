"use client";

import { FiAlertCircle, FiShield, FiX } from "react-icons/fi";
import { useState, useRef, useEffect } from "react";
import BottomSheetModal from "./BottomSheetModal";

interface AvisoMonitoradoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tema: any;
}

export default function AvisoMonitoradoModal({
  isOpen,
  onClose,
  onConfirm,
  tema,
}: AvisoMonitoradoModalProps) {
  const [canConfirm, setCanConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resetar trava ao abrir
  useEffect(() => {
    if (isOpen) {
      setCanConfirm(false);
    }
  }, [isOpen]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Se chegou a 5px do fundo, habilita o botão
    if (scrollHeight - scrollTop <= clientHeight + 5) {
      setCanConfirm(true);
    }
  };

  return (
    <BottomSheetModal 
      isOpen={isOpen} 
      onClose={onClose} 
      maxHeight="80vh"
      disableBackdropClick={true}
    >
      <div className="flex flex-col w-full h-full max-h-[75vh]">
        {/* Header Padronizado */}
        <div className="flex justify-between items-center w-full px-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Aviso
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <FiX size={24} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Área de Texto Com Rolagem */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-2 space-y-6 mb-6 scrollbar-hide"
        >
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5">
            <div className="space-y-4">
              <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed font-bold">
                Para garantir a segurança de todos e a prioridade correta nos atendimentos, lembramos que o relato de informações falsas configura o crime de:
              </p>
              
              <div className="bg-white dark:bg-black/20 p-5 rounded-lg border-l-4 border-red-500 shadow-sm">
                <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">Falsidade Ideológica</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold tracking-wide">
                  Artigo 299 do Código Penal
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 italic mt-2 leading-snug">
                  "Pena: Reclusão de um a cinco anos e multa."
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
              Ao prosseguir, você confirma que seu relato é verdadeiro e condizente com sua necessidade médica atual. O uso indevido deste canal prejudica quem realmente precisa de socorro urgente.
            </p>
          </div>

          {!canConfirm && (
            <div className="flex items-center justify-center gap-2 py-2 text-blue-600 dark:text-blue-400 animate-pulse text-xs font-semibold">
              <span>Role até o fim para liberar o botão</span>
              <div className="w-1 h-1 bg-current rounded-full"></div>
            </div>
          )}
        </div>

        {/* Botão de Ação */}
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className={`w-full font-semibold py-3 rounded-md transition flex items-center justify-center uppercase tracking-widest text-sm border ${
            canConfirm 
              ? `${tema.btnBg} hover:opacity-90 text-white border-transparent` 
              : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700 cursor-not-allowed"
          }`}
        >
          {canConfirm ? "Estou Ciente e Desejo Continuar" : "Leia o aviso para continuar"}
        </button>
      </div>
    </BottomSheetModal>
  );
}
