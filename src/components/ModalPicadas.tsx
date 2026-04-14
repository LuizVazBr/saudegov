"use client";

import { useState, useEffect } from "react";
import { FiX, FiMic } from "react-icons/fi";
import { MdKeyboard } from "react-icons/md";
import { FaCamera } from "react-icons/fa";
import BottomSheetModal from "./BottomSheetModal";

import dynamic from "next/dynamic";

// Carrega o MapaRota apenas no cliente, desativando SSR
const MapaRota = dynamic(() => import("./MapaRota"), { ssr: false });

interface ModalPicadasProps {
  isOpen: boolean;
  onClose: () => void;
  tema: {
    btnBg: string;
    btnHover: string;
    btnMap: string;
    btnHoverMap: string;
  };
}


export default function ModalPicadas({ isOpen, onClose, tema }: ModalPicadasProps) {
  const [animalSelecionado, setAnimalSelecionado] = useState<string | null>(null);
  const [metodoRelato, setMetodoRelato] = useState<string | null>(null);
  const [mostrarMapa, setMostrarMapa] = useState(false);

  // Resetar todos os estados sempre que o modal abrir ou fechar
  useEffect(() => {
    if (!isOpen) {
      setAnimalSelecionado(null);
      setMetodoRelato(null);
      setMostrarMapa(false);
    }
  }, [isOpen]);

  const handleAnimalChange = (animal: string) => {
    setAnimalSelecionado(animal);
    setMetodoRelato(null); // resetar escolha de relato ao mudar animal
  };

  const handleRelatar = () => {
    setMostrarMapa(true);
  };

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        setAnimalSelecionado(null);
        setMetodoRelato(null);
        setMostrarMapa(false);
      }}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-black">
          Relate para receber o local de atendimento
        </h2>
        <button onClick={onClose} className="p-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
          <FiX size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {!mostrarMapa ? (
        <div>
          <p className="mb-4 text-gray-700 dark:text-gray-500">Selecione o animal que causou a picada:</p>

          <div className="flex space-x-3 mb-4">
            {["Escorpião", "Cobra"].map((animal) => (
              <div
                key={animal}
                onClick={() => handleAnimalChange(animal)}
                className={`cursor-pointer border-2 rounded-lg p-4 flex-1 text-center transition 
                  ${animalSelecionado === animal ? "border-blue-500 bg-blue-100" : "border-gray-300 bg-white hover:bg-gray-50"}
                  dark:${animalSelecionado === animal ? "border-blue-400 bg-blue-200" : "border-gray-600 bg-gray-800 hover:bg-gray-400"}`}
              >
                <span className="font-semibold text-gray-800 dark:text-gray-200">{animal}</span>
              </div>
            ))}
          </div>

          {animalSelecionado && (
            <div className="flex flex-col space-y-2 mb-4">
              <p className="text-gray-700 dark:text-gray-500">Como quer relatar as características do animal?</p>

              <button
                onClick={() => setMetodoRelato("Digitando")}
                className={`w-full border-2 border-gray-300 text-gray-700 font-semibold py-3 rounded-md flex items-center justify-center space-x-2 transition ${metodoRelato === "Digitando" ? "bg-gray-200" : ""}`}
              >
                <MdKeyboard size={20} /> <span>Digitando</span>
              </button>

              <button
                onClick={() => setMetodoRelato("Falando")}
                className={`w-full border-2 border-gray-300 text-gray-700 font-semibold py-3 rounded-md flex items-center justify-center space-x-2 transition ${metodoRelato === "Falando" ? "bg-gray-200" : ""}`}
              >
                <FiMic size={20} /> <span>Falando</span>
              </button>

              <button
                onClick={() => setMetodoRelato("Foto")}
                className={`w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-md flex items-center justify-center space-x-2 transition ${metodoRelato === "Foto" ? "bg-yellow-600" : ""}`}
              >
                <FaCamera size={20} /> <span>Tirar foto</span>
              </button>
            </div>
          )}

          {metodoRelato && (
            <button
              onClick={handleRelatar}
              className={`w-full ${tema.btnBg} ${tema.btnHover} text-white font-semibold py-3 rounded-md transition`}
            >
              Buscar atendimento
            </button>
          )}
        </div>
      ) : (
        <div>
          <p className="mb-4 text-gray-700 dark:text-gray-500">Local de atendimento:</p>
          <MapaRota
            isOpen={true}
            onClose={() => setMostrarMapa(false)}
            tema={tema}
            unidadeSelecionada={{ nome: "UBS 1 Guará", lat: -15.7883, lng: -47.9509 }}
            userLocation={null}
          />
          <p className="mt-2 text-gray-700 dark:text-gray-400">
            Siga as instruções no mapa para chegar ao local de atendimento.
          </p>
        </div>
      )}
    </BottomSheetModal>
  );
}
