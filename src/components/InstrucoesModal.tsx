import React, { useEffect } from "react";
import { FiX } from "react-icons/fi";
import BottomSheetModal from "./BottomSheetModal";

interface Tema {
  btnBg: string;
  btnHover: string;
}

interface InstrucoesModalProps {
  isOpen: boolean;
  onClose: () => void;
  comecarAFalar: () => void;
  tocarInstrucoes: () => void;
  tema: Tema;
}

export default function InstrucoesModal({
  isOpen,
  onClose,
  comecarAFalar,
  tocarInstrucoes,
  tema,
}: InstrucoesModalProps) {

  useEffect(() => {
    if (isOpen) tocarInstrucoes();
  }, [isOpen]);

  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-black">
          Instruções para falar os sintomas
        </h2>
        <button onClick={onClose} aria-label="Fechar modal" className="p-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
          <FiX size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
      </div>
      <p className={`mb-6 text-gray-700 dark:text-gray-500`}>
        Vá para um ambiente com menos barulho.
        <br />
        Fale os seus sintomas, você terá até 1 minuto para falar.
      </p>
      <button onClick={comecarAFalar} className={`w-full ${tema.btnBg} ${tema.btnHover} text-white font-semibold py-3 rounded-md transition`}>
        Começar a falar
      </button>
    </BottomSheetModal>
  );
}
