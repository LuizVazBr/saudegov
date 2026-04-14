"use client";

import React, { useState } from "react";
import { FiCamera, FiCheck, FiX, FiFile } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

interface PhotoUploadProps {
  photo: string | null;
  onPhotoCapture: () => void;
  onFileUpload: (file: File) => void;
  onRemove: () => void;
  label?: string;
  evaluatedLabel?: string;
}

export default function PhotoUpload({
  photo,
  onPhotoCapture,
  onFileUpload,
  onRemove,
  label = "Precisamos de uma imagem da sua mancha",
  evaluatedLabel = "Mancha avaliada",
}: PhotoUploadProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!photo ? (
          <motion.div
            key="upload-input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={onPhotoCapture}
                className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-blue-400 rounded-xl bg-blue-50/10 hover:bg-blue-50 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-2 group-hover:scale-110 transition-transform">
                  <FiCamera size={24} />
                </div>
                <span className="text-sm font-bold text-blue-700">{label}</span>
                <span className="text-[10px] text-blue-500 font-medium">Usar câmera do celular</span>
              </button>

              <label className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/30 hover:bg-blue-50 hover:border-blue-400 cursor-pointer transition-all group">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-2 group-hover:scale-110 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                  <FiFile size={24} />
                </div>
                <span className="text-sm font-bold text-gray-700 group-hover:text-blue-700">Escolher na Galeria</span>
                <span className="text-[10px] text-gray-500 font-medium">Fotos ou arquivos</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="upload-result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-4 bg-green-50/50 border border-green-200 p-3 rounded-2xl shadow-sm"
          >
            <div className="relative">
              <img
                src={photo}
                alt="Thumbnail"
                className="w-20 h-20 object-cover rounded-xl border-2 border-white shadow-md"
              />
              <button
                type="button"
                onClick={onRemove}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
              >
                <FiX size={14} />
              </button>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-green-700 font-bold">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                   <FiCheck size={12} />
                </div>
                {evaluatedLabel}
              </div>
              <p className="text-[11px] text-green-600/80 font-medium mt-0.5">
                {photo.startsWith('data:') ? 'Imagem capturada com sucesso' : 'Imagem anexada'}
              </p>
              <button 
                type="button"
                onClick={onPhotoCapture}
                className="text-[10px] text-blue-600 font-bold underline mt-2 hover:text-blue-800 text-left"
              >
                Trocar foto
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
