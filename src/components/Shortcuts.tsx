"use client";

import { GiScorpion, GiAirBalloon } from "react-icons/gi";
import ModalPicadas from "./ModalPicadas";
import ModalEngasgo from "./ModalEngasgo";
import { useState } from "react";

interface ShortcutsProps {
  tema: any;
}

export default function Shortcuts({ tema }: ShortcutsProps) {
  const [modalPicadasAberto, setModalPicadasAberto] = useState(false);
  const [modalEngasgoAberto, setModalEngasgoAberto] = useState(false);

  return (
    <div className="flex items-center justify-between px-5 mb-3 mt-2">
      <span className="text-sm text-gray-500 font-medium">Atalhos</span>
      <div className="flex space-x-3">
        {/* Atalho picadas */}
        <div
          className="w-10 h-10 rounded-full border-2 border-blue-400 flex items-center justify-center text-blue-500 transition-colors duration-200 hover:bg-blue-50 cursor-pointer"
          onClick={() => setModalPicadasAberto(true)}
        >
          <GiScorpion size={20} />
        </div>
        <ModalPicadas
          isOpen={modalPicadasAberto}
          onClose={() => setModalPicadasAberto(false)}
          tema={tema}
        />

        {/* Atalho engasgo */}
        <div
          className="w-10 h-10 rounded-full border-2 border-blue-400 flex items-center justify-center text-blue-500 transition-colors duration-200 hover:bg-blue-50 cursor-pointer"
          onClick={() => setModalEngasgoAberto(true)}
        >
          <GiAirBalloon size={20} />
        </div>
        <ModalEngasgo
          isOpen={modalEngasgoAberto}
          onClose={() => setModalEngasgoAberto(false)}
          tema={tema}
        />
      </div>
    </div>
  );
}
