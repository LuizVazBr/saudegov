"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

interface CustomSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (val: number) => void;
  label?: string;
  color?: string;
}

export default function CustomSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  color = "bg-blue-600",
}: CustomSliderProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (constraintsRef.current) {
      setWidth(constraintsRef.current.offsetWidth);
    }
    const handleResize = () => {
      if (constraintsRef.current) setWidth(constraintsRef.current.offsetWidth);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const percentage = ((value - min) / (max - min)) * 100;
  
  // Usar motion value para sincronizar x com o valor atual
  const x = useMotionValue(0);

  useEffect(() => {
    if (width > 0) {
      const targetX = (percentage / 100) * width;
      x.set(targetX);
    }
  }, [value, width, percentage, x]);

  const handleDrag = () => {
    const currentX = x.get();
    const newPercentage = Math.min(Math.max(currentX / width, 0), 1);
    const newValue = min + newPercentage * (max - min);
    const steppedValue = Math.round(newValue / step) * step;
    onChange(Number(steppedValue.toFixed(1)));
  };

  return (
    <div className="w-full py-8 select-none">
      {label && (
        <label className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-6">
          {label}
        </label>
      )}
      
      <div className="relative h-4 flex items-center">
        {/* Track Background */}
        <div 
          ref={constraintsRef}
          className="absolute w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer overflow-hidden"
          onClick={(e) => {
            const rect = constraintsRef.current?.getBoundingClientRect();
            if (rect) {
              const clickX = e.clientX - rect.left;
              const newPercentage = Math.min(Math.max(clickX / width, 0), 1);
              const newValue = min + newPercentage * (max - min);
              const steppedValue = Math.round(newValue / step) * step;
              onChange(Number(steppedValue.toFixed(1)));
            }
          }}
        >
          {/* Progress Fill */}
          <motion.div
             className={`h-full ${color}`}
             style={{ width: `${percentage}%` }}
             initial={false}
          />
        </div>

        {/* Thumb */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: width }}
          dragElastic={0}
          dragMomentum={false}
          onDrag={handleDrag}
          style={{ x, left: 0 }}
          className="absolute -ml-5 w-10 h-10 bg-white border-4 border-blue-500 rounded-full shadow-xl cursor-grab active:cursor-grabbing flex items-center justify-center z-10 touch-none"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 1.2, boxShadow: "0 0 20px rgba(59, 130, 246, 0.4)" }}
        >
           <div className="w-3 h-3 bg-blue-500 rounded-full" />
           
           {/* Tooltip vindo do Thumb */}
           <div className="absolute -top-12 flex flex-col items-center pointer-events-none">
              <div className="bg-blue-600 text-white text-sm font-black px-3 py-1.5 rounded-lg shadow-lg">
                {value}
              </div>
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-blue-600" />
           </div>
        </motion.div>
      </div>

      <div className="flex justify-between mt-6 px-1">
        <span className="text-xs font-black text-gray-400">{min}</span>
        <span className="text-xs font-black text-gray-400">{max}</span>
      </div>
    </div>
  );
}
