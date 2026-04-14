"use client";

import { useEffect } from "react";
import { FiX } from "react-icons/fi";
import BottomSheetModal from "./BottomSheetModal";
import { toast } from "sonner";

interface ReceberLigacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  numero: string;
  tema: { btnBg: string; btnHover: string };
  onReceberLigacao: () => void;
}

export default function ReceberLigacaoModal({
  isOpen,
  onClose,
  numero,
  tema,
}: ReceberLigacaoModalProps) {

  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-black">
          Receber ligação
        </h2>
        <button
          onClick={onClose}
          aria-label="Fechar modal"
          className="p-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          <FiX size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
      </div>
      <p className={`mb-4 text-gray-700 dark:text-gray-500`}>
        Você receberá uma ligação para relatar seus sintomas. A chamada será feita do número abaixo:
      </p>
      <p className={`mb-6 text-2xl font-bold text-gray-800 dark:text-gray-800`}>
        {numero}
      </p>
<button
  className={`w-full ${tema.btnBg} ${tema.btnHover} text-white font-semibold py-3 rounded-md transition`}
  onClick={async () => {
    try {
      const res = await fetch("/api/ligacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          to: "+5561998432678", 
          nome: "Luiz",
          type: "sintomas"
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Ligação iniciada! SID: " + data.sid);
      } else {
        toast.error("Erro ao iniciar ligação: " + data.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao iniciar ligação.");
    }
  }}
>
  Quero receber a ligação agora
</button>



    </BottomSheetModal>
  );
}
