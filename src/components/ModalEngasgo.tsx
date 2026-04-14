"use client";

import { useState, useEffect } from "react";
import { FiX, FiHeadphones } from "react-icons/fi";
import BottomSheetModal from "./BottomSheetModal";
import Image from "next/image";

interface ModalEngasgoProps {
  isOpen: boolean;
  onClose: () => void;
  tema: { btnBg: string; btnHover: string };
}

interface Step {
  titulo: string;
  descricao: string;
  imagem: string;
}

const passosBebe: Step[] = [
  { titulo: "Avaliar consciência", descricao: "Posicione o bebê de bruços sobre o antebraço, cabeça ligeiramente inclinada para baixo.", imagem: "/engasgo_bebe_01.png" },
  { titulo: "Golpes nas costas", descricao: "Dar 5 tapinhas firmes entre as omoplatas.", imagem: "/engasgo_bebe_02.png" },
  { titulo: "Compressões torácicas", descricao: "Vire o bebê de costas e faça 5 compressões no meio do peito com 2 dedos.", imagem: "/engasgo_bebe_03.png" },
  { titulo: "Verificar a boca", descricao: "Se visível, retirar cuidadosamente o objeto com o dedo.", imagem: "/engasgo_bebe_04.png" },
  { titulo: "Chamar SAMU", descricao: "Se o bebê continuar engasgado, ligar imediatamente 192.", imagem: "/engasgo_bebe_05.png" },
];

const passosCrianca: Step[] = [
  { titulo: "Avaliar consciência", descricao: "Perguntar se consegue tossir ou falar.", imagem: "/engasgo_crianca_01.png" },
  { titulo: "Incentivar a tossir", descricao: "Se tossir, deixar tossir espontaneamente.", imagem: "/engasgo_crianca_02.png" },
  { titulo: "Manobra de Heimlich", descricao: "Ficar atrás, punho fechado acima do umbigo, 5 compressões rápidas para dentro e para cima.", imagem: "/engasgo_crianca_03.png" },
  { titulo: "Repetir se necessário", descricao: "Alternar entre compressões e incentivo a tossir até desobstruir.", imagem: "/engasgo_crianca_04.png" },
  { titulo: "Chamar SAMU", descricao: "Se não houver melhora, ligar 192 imediatamente.", imagem: "/engasgo_crianca_05.png" },
];

const passosAdulto: Step[] = [
  { titulo: "Avaliar consciência", descricao: "Perguntar se consegue tossir ou falar.", imagem: "/engasgo_adulto_01.png" },
  { titulo: "Incentivar a tossir", descricao: "Se tossir, deixar tossir naturalmente.", imagem: "/engasgo_adulto_02.png" },
  { titulo: "Manobra de Heimlich", descricao: "Ficar atrás, punho fechado acima do umbigo, 5 compressões rápidas para dentro e para cima.", imagem: "/engasgo_adulto_03.png" },
  { titulo: "Repetir se necessário", descricao: "Até a obstrução sair ou a pessoa perder a consciência.", imagem: "/engasgo_adulto_04.png" },
  { titulo: "Se inconsciente", descricao: "Iniciar RCP e ligar SAMU imediatamente.", imagem: "/engasgo_adulto_05.png" },
];

export default function ModalEngasgo({ isOpen, onClose, tema }: ModalEngasgoProps) {
  const [selecionado, setSelecionado] = useState<string>("");
  const [passoAtual, setPassoAtual] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelecionado("");
      setPassoAtual(null);
    }
  }, [isOpen]);

  const passosMap: Record<string, Step[]> = {
    Bebe: passosBebe,
    Criança: passosCrianca,
    Adulto: passosAdulto,
  };

  const passosAtuais = selecionado && passosMap[selecionado] ? passosMap[selecionado] : [];

  const handleProximo = () => {
    if (passoAtual === null) return;
    if (passoAtual < passosAtuais.length - 1) {
      setPassoAtual(passoAtual + 1);
    } else {
      setPassoAtual(null); // finalizou todos os passos
    }
  };

  const handleEscolha = (opcao: string) => {
    setSelecionado(opcao);
    setPassoAtual(0);
  };

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={() => { onClose(); setSelecionado(""); setPassoAtual(null); }}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-black">
          Engasgo
        </h2>
        <button onClick={onClose} className="p-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
          <FiX size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {!selecionado ? (
        <div>
          <p className="mb-4 text-gray-700 dark:text-gray-500">Selecione o paciente:</p>
          <div className="flex space-x-3 mb-4">
            {["Bebe", "Criança", "Adulto"].map((opcao) => (
              <div
                key={opcao}
                onClick={() => handleEscolha(opcao)}
                className={`cursor-pointer border-2 rounded-lg p-4 flex-1 text-center transition
                  ${selecionado === opcao ? "border-gray-500 bg-gray-100" : "border-gray-300 bg-white hover:bg-gray-50"}
                  dark:${selecionado === opcao ? "border-gray-400 bg-gray-200" : "border-gray-600 bg-gray-400 hover:bg-gray-400"}`}
              >
                <span className="font-semibold text-gray-800 dark:text-gray-200">{opcao}</span>
              </div>
            ))}
          </div>
        </div>
      ) : passoAtual !== null && passosAtuais[passoAtual] ? (
        <div className="flex flex-col items-center w-full">
          <h3 className="text-lg font-semibold mb-2">{passosAtuais[passoAtual].titulo}</h3>
          <div className="mb-2 w-48 h-48 relative">
            <Image
              src={passosAtuais[passoAtual].imagem}
              alt={passosAtuais[passoAtual].titulo}
              fill
              className="object-contain"
            />
          </div>
          <p className="text-gray-700 dark:text-gray-500 mb-2">{passosAtuais[passoAtual].descricao}</p>

          <div className="w-full flex justify-end mb-4">
            <button className={`p-2 rounded-full ${tema.btnBg} ${tema.btnHover} text-white`}>
              <FiHeadphones size={20} />
            </button>
          </div>

          <button
            onClick={handleProximo}
            className={`w-full ${tema.btnBg} ${tema.btnHover} text-white font-semibold py-3 rounded-md transition`}
          >
            Próximo passo
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <p className="mb-4 text-gray-700 dark:text-gray-500">Local de atendimento:</p>
          <div className="w-full h-64 bg-gray-200 dark:bg-gray-700 mb-2 flex items-center justify-center">
            <span className="text-gray-500">[Mapa do local]</span>
          </div>
          <p className="text-gray-700 dark:text-gray-400 text-center">O SAMU já está a caminho.</p>
          <button
            onClick={onClose}
            className={`w-full ${tema.btnBg} ${tema.btnHover} text-white font-semibold py-3 rounded-md transition mt-4`}
          >
            Fechar
          </button>
        </div>
      )}
    </BottomSheetModal>
  );
}
