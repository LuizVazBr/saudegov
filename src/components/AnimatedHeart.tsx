"use client";
import { useEffect, useState, useRef } from "react";

type AnimatedHeartProps = {
  peaks: number[]; // tempos em segundos dos picos do ECG
  onFinish?: () => void;
};

export default function AnimatedHeart({ peaks, onFinish }: AnimatedHeartProps) {
  const [scale, setScale] = useState(1);
  const [fill, setFill] = useState("rgb(239, 68, 68)"); // vermelho base
  const startTimeRef = useRef<number | null>(null);
  const indexRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = (time - startTimeRef.current) / 1000; // em segundos

      // Se chegou no tempo do próximo pico → bate o coração
      if (indexRef.current < peaks.length && elapsed >= peaks[indexRef.current]) {
        setScale(1.3); // coração aumenta
        setFill("rgb(220, 38, 38)"); // fica mais vermelho

        setTimeout(() => {
          setScale(1); // volta ao normal
          setFill("rgb(239, 68, 68)");
        }, 200);

        indexRef.current++;
      }

      if (indexRef.current < peaks.length) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        if (onFinish) onFinish(); // terminou todos os picos
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [peaks, onFinish]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="80"
      height="80"
      style={{
        transform: `scale(${scale})`,
        transition: "transform 0.2s ease, fill 0.2s ease",
        fill,
      }}
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 
               4.42 3 7.5 3c1.74 0 3.41 0.81 
               4.5 2.09C13.09 3.81 14.76 3 
               16.5 3 19.58 3 22 5.42 22 
               8.5c0 3.78-3.4 6.86-8.55 
               11.54L12 21.35z"/>
    </svg>
  );
}
