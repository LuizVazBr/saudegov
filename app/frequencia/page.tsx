"use client";

import { useEffect, useRef, useState } from "react";
import { fft } from "fft-js";

export default function FacePPG() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);

  const frameDataRef = useRef<number[]>([]);
  const fps = 30;
  const sampleLength = 256;
  const finalCaptureTime = 5 * 1000;

  const faceBox = { x: 100, y: 50, width: 200, height: 200 };
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = async () => {
    if (capturing || !videoRef.current) return;
    setProgress(0);

    // Importa face-api somente no cliente
    const faceapi = await import("@vladmandic/face-api");
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      videoRef.current.srcObject = stream;
      videoRef.current.autoplay = true;
      videoRef.current.playsInline = true;
      videoRef.current.muted = true;
      await videoRef.current.play();

      setCapturing(true);
    } catch (err: any) {
      console.error("Erro ao acessar câmera:", err);
      alert("Erro ao acessar câmera: " + err.message);
    }
  };

  useEffect(() => {
    if (!capturing) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let faceapi: typeof import("@vladmandic/face-api");

    const loadFaceApi = async () => {
      faceapi = await import("@vladmandic/face-api");
    };

    loadFaceApi();

    const interval = setInterval(async () => {
      if (!faceapi) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 2;
      ctx.strokeRect(faceBox.x, faceBox.y, faceBox.width, faceBox.height);

      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks();

      if (detections) {
        const { x, y, width, height } = detections.detection.box;
        const insideBox =
          x > faceBox.x &&
          y > faceBox.y &&
          x + width < faceBox.x + faceBox.width &&
          y + height < faceBox.y + faceBox.height;

        if (insideBox) {
          setFaceDetected(true);
          ctx.strokeStyle = "lime";
          ctx.strokeRect(x, y, width, height);

          if (captureTimeoutRef.current) {
            clearTimeout(captureTimeoutRef.current);
            captureTimeoutRef.current = null;
          }

          const faceData = ctx.getImageData(x, y, width, height).data;
          let sum = 0;
          for (let i = 0; i < faceData.length; i += 4) sum += faceData[i];
          const avg = sum / (faceData.length / 4);
          frameDataRef.current.push(avg);

          if (frameDataRef.current.length > sampleLength)
            frameDataRef.current.shift();

          setProgress(
            Math.min(100, (frameDataRef.current.length / sampleLength) * 100)
          );

          if (frameDataRef.current.length >= sampleLength) {
            const bpmEstimate = calculateBPM(frameDataRef.current, fps);
            setBpm(bpmEstimate);
          }
        } else {
          setFaceDetected(false);
          if (!captureTimeoutRef.current) {
            captureTimeoutRef.current = setTimeout(() => {
              const bpmEstimate = calculateBPM(frameDataRef.current, fps);
              setBpm(bpmEstimate);
            }, finalCaptureTime);
          }
        }
      } else {
        setFaceDetected(false);
        if (!captureTimeoutRef.current) {
          captureTimeoutRef.current = setTimeout(() => {
            const bpmEstimate = calculateBPM(frameDataRef.current, fps);
            setBpm(bpmEstimate);
          }, finalCaptureTime);
        }
      }
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [capturing]);

  const calculateBPM = (data: number[], fps: number) => {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const zeroMean = data.map((v) => v - mean);
    const complexSignal: [number, number][] = zeroMean.map(
      (v) => [v, 0] as [number, number]
    );
    const phasors = fft(complexSignal);
    const magnitudes = phasors
      .slice(0, phasors.length / 2)
      .map(([re, im]) => Math.sqrt(re * re + im * im));

    let maxIndex = 0;
    let maxMag = 0;
    magnitudes.forEach((mag, i) => {
      if (mag > maxMag) {
        maxMag = mag;
        maxIndex = i;
      }
    });

    const freqHz = (maxIndex * fps) / data.length;
    const bpm = freqHz * 60;
    if (bpm < 40 || bpm > 180) return null;
    return Math.round(bpm);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>PPG Facial - Frequência Cardíaca</h1>
      <div style={{ position: "relative", width: 400, height: 300 }}>
        <video
          ref={videoRef}
          width={400}
          height={300}
          style={{ border: "1px solid black" }}
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      </div>
      <button onClick={startCamera} disabled={capturing} style={{ marginTop: 20 }}>
        {capturing ? "Capturando..." : "Iniciar Medição"}
      </button>
      {!faceDetected && capturing && (
        <p style={{ color: "red" }}>Coloque seu rosto dentro do retângulo amarelo!</p>
      )}
      {bpm !== null && <h2>BPM estimado: {bpm}</h2>}
      <div style={{ marginTop: 10 }}>
        <progress value={progress} max={100} style={{ width: "100%" }} />
        <p>Progresso: {Math.round(progress)}%</p>
      </div>
    </div>
  );
}
