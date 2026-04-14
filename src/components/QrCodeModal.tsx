"use client";

import React from "react";
import { QRCodeCanvas } from "qrcode.react";
import { FiX } from "react-icons/fi";
import BottomSheetModal from "../components/BottomSheetModal";

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  darkMode: boolean; // já tá recebendo
}

export default function QrCodeModal({
  isOpen,
  onClose,
  token,
  darkMode,
}: QrCodeModalProps) {
  if (!isOpen) return null;

  const url = `${token}`;


  return (
    <BottomSheetModal isOpen={isOpen} onClose={onClose}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-600">
          QR Code para triagem
        </h2>
        <button
          onClick={onClose}
          aria-label="Fechar modal"
          className="p-0 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          <FiX size={24} className="text-gray-600 dark:text-gray-300" />
        </button>
      </div>
      <div className="flex justify-center mb-4">
        <QRCodeCanvas
          value={url}
          size={200}
          bgColor={darkMode ? "#1F2937" : "#ffffff"} // 👈 usando darkMode
          fgColor={darkMode ? "#ffffff" : "#000000"} // 👈 cor do QR code
        />
      </div>
      <p className="text-center text-gray-700 dark:text-gray-400 break-all">
        {url}
      </p>
    </BottomSheetModal>
  );
}
