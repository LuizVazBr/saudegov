import React from "react";

interface EnderecoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EnderecoModal({ isOpen, onClose }: EnderecoModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 p-6 rounded max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Endereço da UPA de Araguaína - TO
        </h2>
        <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
          {`UPA Araguaína - Tocantins
Endereço: Av. Cônego João Lima, 560 - Setor Araguaína Sul, Araguaína - TO, 77820-000

Como chegar:
- Pela Av. Filadélfia, siga sentido sul até a rotatória com a Av. Cônego João Lima.
- Pegue a segunda saída na rotatória para Av. Cônego João Lima.
- A UPA fica do lado direito, próximo ao Hospital Regional.`}
        </pre>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
