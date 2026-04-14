import React, { useEffect, useState } from "react";
import { FiX, FiMapPin } from "react-icons/fi";
import BottomSheetModal from "./BottomSheetModal";

interface Tema {
  btnBg: string;
  btnHover: string;
}

interface GeoExplicacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermitir: () => void; // 🔹 callback para pedir geolocalização
  tema: Tema;
}

export default function GeoExplicacaoModal({
  isOpen,
  onClose,
  onPermitir,
  tema,
}: GeoExplicacaoModalProps) {
  const [plataforma, setPlataforma] = useState<"ios" | "android" | "outro">("outro");

  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    if (/android/i.test(ua)) {
      setPlataforma("android");
    } else if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
      setPlataforma("ios");
    } else {
      setPlataforma("outro");
    }
  }, []);

  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose} className="max-h-[50vh]">
      {/* Botão fechar absoluto no topo */}
      <button
        onClick={onClose}
        aria-label="Fechar modal"
        className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition z-10"
      >
        <FiX size={24} className="text-gray-600 dark:text-gray-300" />
      </button>

      {/* Ícone com animação pulse */}
      <div className="flex justify-center mt-8 mb-4 relative">
        <div className="w-28 h-28 rounded-full bg-blue-100 flex items-center justify-center animate-pulse">
          <FiMapPin size={60} className="text-blue-600" />
        </div>
      </div>

      {/* Cabeçalho */}
      <h2 className="text-xl font-semibold text-gray-800 dark:text-black mb-4 text-center">
        Localização
      </h2>

      {/* Texto explicativo */}
      <p className="mb-6 text-gray-700 dark:text-gray-500 text-left font-medium">
        Para continuar, é necessário ativar a localização para que possamos identificar a unidade de saúde mais próxima da sua região.
      </p>

      {/* Instruções específicas */}
      <div className="mb-6 text-gray-700 dark:text-gray-500 text-md">
        <p className="mb-2 text-left">
          Ao clicar em <b>"Permitir localização"</b>, surgirá uma mensagem
          pedindo sua autorização:
        </p>

        {plataforma === "ios" && (
          <p className="text-left italic">
            No iOS aparecerá:<br />
            <b>“O site triagem.cliv.app quer usar sua localização”</b>
          </p>
        )}

        {plataforma === "android" && (
          <p className="text-left italic">
            No Android aparecerá:<br />
            <b>
              “triagem.cliv.app quer acessar o local do seu
              dispositivo”
            </b>
          </p>
        )}

        {plataforma === "outro" && (
          <p className="text-left italic">
            Seu navegador exibirá uma mensagem pedindo permissão para
            compartilhar sua localização com este site.
          </p>
        )}
      </div>

      {/* Botão de ação */}
      <button
        onClick={onPermitir}
        className={`w-full ${tema.btnBg} ${tema.btnHover} text-white font-semibold py-3 rounded-md transition`}
      >
        Permitir localização
      </button>
    </BottomSheetModal>
  );
}
