import React from "react";
import { FiX } from "react-icons/fi";
import BottomSheetModal from "./BottomSheetModal";

interface Tema {
  btnBg: string;
  btnHover: string;
}

interface SaibaMaisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SaibaMaisModal({ isOpen, onClose }: SaibaMaisModalProps) {
  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose}>
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white">
          Como medir seu ECG
        </h2>
        <button
          onClick={onClose}
          aria-label="Fechar modal"
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          <FiX size={20} className="text-gray-500 dark:text-white" />
        </button>
      </div>

      <div className="mb-3 text-sm text-gray-600 dark:text-gray-300 space-y-1 max-h-[15vh] overflow-y-auto pr-2">
        <p>1. Escolha um ambiente silencioso para evitar ruídos.</p>
        <p>2. Posicione o celular junto ao peito, na altura do coração.</p>
        <p>3. Mantenha-se calmo e respire normalmente.</p>
        <p>4. Capture 10 segundos de áudio para análise.</p>
      </div>

      <div className="flex justify-center">
        <button
          onClick={onClose}
          className="px-10 bg-cyan-500 hover:bg-cyan-600 text-white font-medium py-2 rounded-full transition text-sm shadow-sm"
        >
          Entendi
        </button>
      </div>
    </BottomSheetModal>
  );
}
