"use client";

import React, { useEffect, useRef, useState } from "react";
// @ts-ignore
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import FFT from "fft.js";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type Status = "idle" | "countdown" | "measuring" | "done";

export default function CameraRPPG() {
  // refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // UI / flow states
  const [status, setStatus] = useState<Status>("idle");
  const [countdown, setCountdown] = useState<number>(3); // seconds before measuring
  const MEASURE_SECONDS = 30; // measurement duration (you can change)
  const [timeLeft, setTimeLeft] = useState<number>(MEASURE_SECONDS);

  // results
  const [bpm, setBpm] = useState<number | null>(null); // smoothed BPM
  const [bpmRaw, setBpmRaw] = useState<number | null>(null); // raw from FFT (freqHz*60)
  const [freqHz, setFreqHz] = useState<number | null>(null); // Hz
  const [hrv, setHrv] = useState<number | null>(null);
  const [spo2, setSpO2] = useState<number | null>(null);

  // plotting & buffers
  const [signalData, setSignalData] = useState<number[]>([]);
  const bufferGRef = useRef<number[]>([]); // global buffers are refs to persist inside RAF
  const bufferRRef = useRef<number[]>([]);
  const bpmHistoryRef = useRef<number[]>([]);
  const spo2HistoryRef = useRef<number[]>([]);

  // constants
  const fps = 15;
  const WINDOW = Math.max( Math.floor(fps * MEASURE_SECONDS), 128 ); // measurement window size in frames
  const lowBPM = 48;
  const highBPM = 180;

  // helpers
  function normalizeMean(data: number[]) {
    if (data.length === 0) return data;
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    return data.map(v => v - mean);
  }

  function detrend(data: number[]) {
    // simple detrend by subtracting moving average (long)
    if (data.length === 0) return data;
    const L = data.length;
    const mean = data.reduce((a, b) => a + b, 0) / L;
    return data.map(v => v - mean);
  }

  function nextPowerOfTwo(n: number) {
    return 2 ** Math.floor(Math.log2(n));
  }

  function computeFFTPeakBPM(signal: number[], fps: number) {
    // returns {freqHz, bpm} or null
    const N = signal.length;
    if (N < 8) return null;
    const f = new FFT(N);
    const out = f.createComplexArray();
    const data = f.toComplexArray(signal, out);
    f.transform(out, data);

    let maxIdx = -1;
    let maxVal = -Infinity;
    for (let k = 1; k < N / 2; k++) {
      const re = out[2 * k];
      const im = out[2 * k + 1];
      const power = re * re + im * im;
      const freqHz = (k * fps) / N;
      const bpmVal = freqHz * 60;
      if (bpmVal >= lowBPM && bpmVal <= highBPM && power > maxVal) {
        maxVal = power;
        maxIdx = k;
      }
    }
    if (maxIdx === -1) return null;
    const freqHz = (maxIdx * fps) / N;
    return { freqHz, bpm: freqHz * 60 };
  }

  // moving average function (simple)
  function movingAverage(data: number[], win: number) {
    const out: number[] = [];
    const half = Math.floor(win / 2);
    for (let i = 0; i < data.length; i++) {
      let s = 0;
      let c = 0;
      const start = Math.max(0, i - half);
      const end = Math.min(data.length - 1, i + half);
      for (let j = start; j <= end; j++) {
        s += data[j];
        c++;
      }
      out.push(c ? s / c : 0);
    }
    return out;
  }

  // approximate band-pass using two moving averages:
  // highpass: signal - longMA (remove drift < ~0.8Hz)
  // lowpass: apply shortMA to remove > ~3Hz noise
  function approxBandpass(data: number[], fps: number) {
    if (data.length === 0) return data;
    // estimate windows:
    // cutoff_high ~ 0.8 Hz -> period ~ 1.25s -> window ~ fps * 1.25
    // cutoff_low ~ 3 Hz -> period ~ 0.333s -> window ~ fps * 0.333
    const winHigh = Math.max(3, Math.floor(fps * 1.25)); // long MA
    const winLow = Math.max(3, Math.floor(fps * 0.333)); // short MA
    const longMA = movingAverage(data, winHigh);
    const highpassed = data.map((v, i) => v - longMA[i]);
    const bandpassed = movingAverage(highpassed, winLow);
    return bandpassed;
  }

  // approximate HRV (SDNN) from peaks of the bandpassed signal
  function computeHRVFromSignal(sig: number[], fps: number) {
    if (!sig || sig.length < 10) return null;
    const peaks: number[] = [];
    // simple prominence/threshold peak detection
    const threshold = (Math.max(...sig) + Math.min(...sig)) / 2;
    for (let i = 2; i < sig.length - 2; i++) {
      if (sig[i] > sig[i - 1] && sig[i] > sig[i + 1] && sig[i] > threshold * 0.6) {
        peaks.push(i);
      }
    }
    if (peaks.length < 2) return null;
    const rr = [];
    for (let i = 1; i < peaks.length; i++) rr.push((peaks[i] - peaks[i - 1]) / fps);
    if (rr.length === 0) return null;
    const meanRR = rr.reduce((a, b) => a + b, 0) / rr.length;
    const sdnn = Math.sqrt(rr.reduce((acc, v) => acc + (v - meanRR) ** 2, 0) / rr.length) * 1000;
    return sdnn;
  }

  // improved SpO2 estimation (approx): compute AC (std) of bandpassed signals and DC as mean of raw.
  // Use softer calibration constant and smoothing
  function estimateSpO2FromBuffers(bufR: number[], bufG: number[]) {
    if (bufR.length < 20 || bufG.length < 20) return null;
    // bandpass both
    const bpR = approxBandpass(bufR, fps);
    const bpG = approxBandpass(bufG, fps);
    // AC = stddev of bandpassed; DC = mean of raw
    function std(arr: number[]) {
      const m = arr.reduce((a, b) => a + b, 0) / arr.length;
      return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
    }
    const acR = std(bpR);
    const acG = std(bpG);
    const dcR = bufR.reduce((a, b) => a + b, 0) / bufR.length;
    const dcG = bufG.reduce((a, b) => a + b, 0) / bufG.length;
    if (dcR === 0 || dcG === 0 || acG === 0) return null;
    const ratio = (acR / dcR) / (acG / dcG);

    // softer empirical mapping (less aggressive than 110-25*ratio)
    // This mapping is approximate; adjust constants to tune for your camera/lighting.
    const spo2Est = 104 - 17 * ratio;
    return Math.max(75, Math.min(99, spo2Est)); // clamp to reasonable range
  }

  // measurement flow: start, countdown, measure fixed seconds, then compute final metrics
  async function startMeasurement() {
    // reset buffers
    bufferGRef.current = [];
    bufferRRef.current = [];
    bpmHistoryRef.current = [];
    spo2HistoryRef.current = [];
    setSignalData([]);
    setBpm(null);
    setBpmRaw(null);
    setFreqHz(null);
    setHrv(null);
    setSpO2(null);

    setStatus("countdown");
    setCountdown(3);

    // countdown
    for (let s = 3; s >= 1; s--) {
      setCountdown(s);
      await new Promise(res => setTimeout(res, 1000));
    }

    // start measuring
    setStatus("measuring");
    setTimeLeft(MEASURE_SECONDS);

    // countdown display loop
    const t0 = Date.now();
    const intervalId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - t0) / 1000);
      setTimeLeft(Math.max(0, MEASURE_SECONDS - elapsed));
    }, 250);

    // measurement completes after MEASURE_SECONDS
    await new Promise(res => setTimeout(res, MEASURE_SECONDS * 1000));

    clearInterval(intervalId);

    // after measurement, compute final results from buffers
    const bufG = bufferGRef.current.slice();
    const bufR = bufferRRef.current.slice();

    // ensure enough samples
    const N = nextPowerOfTwo(bufG.length);
    const useSignal = detrend(normalizeMean(bufG.slice(-N)));
    const fftRes = computeFFTPeakBPM(useSignal, fps);
    if (fftRes) {
      const freq = fftRes.freqHz;
      const rawBpm = fftRes.bpm;
      setFreqHz(freq);
      setBpmRaw(rawBpm);
      // smoothing: push into bpmHistoryRef then set smoothed BPM
      bpmHistoryRef.current.push(rawBpm);
      if (bpmHistoryRef.current.length > 10) bpmHistoryRef.current.shift();
      const bpmAvg = Math.round((bpmHistoryRef.current.reduce((a, b) => a + b, 0) / bpmHistoryRef.current.length) * 10) / 10;
      setBpm(bpmAvg);
    }

    // HRV
    const bpSig = approxBandpass(bufG.slice(-N), fps);
    const hrvVal = computeHRVFromSignal(bpSig, fps);
    if (hrvVal) setHrv(hrvVal);

    // SpO2 estimation with smoothing
    const spo2Val = estimateSpO2FromBuffers(bufR.slice(-N), bufG.slice(-N));
    if (spo2Val) {
      // push to history and average
      spo2HistoryRef.current.push(spo2Val);
      if (spo2HistoryRef.current.length > 6) spo2HistoryRef.current.shift();
      const avg = spo2HistoryRef.current.reduce((a, b) => a + b, 0) / spo2HistoryRef.current.length;
      setSpO2(Math.round(avg * 10) / 10);
    }

    setStatus("done");
  }

  // main loop: runs always to update canvas & collect frames while measuring
  useEffect(() => {
    let animationFrame = 0;
    let faceLandmarker: FaceLandmarker | null = null;
    let inited = false;

    async function init() {
      if (!videoRef.current || !canvasRef.current) return;
      // load mediapipe fileset and model
      const fileset = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");
      faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        },
        runningMode: "VIDEO",
        numFaces: 1,
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current!.srcObject = stream;
      await videoRef.current!.play();

      inited = true;

      const ctx = canvasRef.current!.getContext("2d", { willReadFrequently: true })!;
      const interval = 1000 / fps;
      let lastTime = 0;

      function loop(time: number) {
        animationFrame = requestAnimationFrame(loop);
        if (!videoRef.current || !ctx) return;
        if (time - lastTime < 1000 / fps) return;
        lastTime = time;

        // draw video
        const canvasWidth = canvasRef.current!.clientWidth;
        const canvasHeight = (videoRef.current!.videoHeight / videoRef.current!.videoWidth) * canvasWidth || canvasWidth * (4/3);
        canvasRef.current!.width = canvasWidth;
        canvasRef.current!.height = canvasHeight;
        ctx.drawImage(videoRef.current!, 0, 0, canvasWidth, canvasHeight);

        // detect landmarks
        const detections = faceLandmarker!.detectForVideo(videoRef.current!, time);
        if (detections.faceLandmarks && detections.faceLandmarks.length > 0) {
          const landmarks = detections.faceLandmarks[0];

          // Select ROI: forehead. If you want bochecha, replace indices accordingly.
          const foreheadPoints = [10, 338, 297, 332, 284, 251]; // approximate topline
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const idx of foreheadPoints) {
            const p = landmarks[idx];
            minX = Math.min(minX, p.x * canvasWidth);
            maxX = Math.max(maxX, p.x * canvasWidth);
            minY = Math.min(minY, p.y * canvasHeight);
            maxY = Math.max(maxY, p.y * canvasHeight);
          }
          const rectHeight = Math.max(30, (maxY - minY)); // ensure some height
          const rectWidth = Math.max(20, (maxX - minX));
          // draw
          ctx.strokeStyle = "yellow";
          ctx.lineWidth = 2;
          ctx.strokeRect(minX, minY, rectWidth, rectHeight);

          // only collect when measuring (status === measuring)
          if (status === "measuring") {
            try {
              const imgData = ctx.getImageData(Math.round(minX), Math.round(minY), Math.round(rectWidth), Math.round(rectHeight)).data;
              // average R and G channels
              let sumR = 0, sumG = 0, count = 0;
              for (let i = 0; i < imgData.length; i += 4) {
                sumR += imgData[i];
                sumG += imgData[i + 1];
                count++;
              }
              const avgR = sumR / count;
              const avgG = sumG / count;
              // push to buffers
              bufferGRef.current.push(avgG);
              bufferRRef.current.push(avgR);
              if (bufferGRef.current.length > WINDOW) bufferGRef.current.shift();
              if (bufferRRef.current.length > WINDOW) bufferRRef.current.shift();
              // update chart data periodically (do not update every frame to reduce re-renders)
              if (bufferGRef.current.length % 2 === 0) {
                setSignalData([...bufferGRef.current]);
              }
            } catch (err) {
              // getImageData can throw if rect out of bounds; ignore
            }
          } else {
            // when not measuring keep small preview buffer for UI if needed
          }
        }
      }

      animationFrame = requestAnimationFrame(loop);
    }

    init();

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (faceLandmarker) faceLandmarker.close();
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]); // re-run only when status changes (so measurement collection responds)

  // Chart data
  const chartData = {
    labels: signalData.map((_, i) => i),
    datasets: [
      {
        label: "Sinal Verde (RPPG)",
        data: signalData,
        borderColor: "green",
        backgroundColor: "rgba(0,255,0,0.08)",
        tension: 0.2,
        pointRadius: 0,
      },
    ],
  };
  const chartOptions = { animation: { duration: 0 }, responsive: true, scales: { x: { display: false } } };

  // UI small helpers
  function renderControls() {
    if (status === "idle") {
      return (
        <>
          <p style={{ marginTop: 8 }}>Posicione o rosto frontal e relaxe. Evite movimentos e mudanças de iluminação.</p>
          <button onClick={() => startMeasurement()} style={{ padding: "12px 20px", fontSize: 16, marginTop: 8 }}>
            Iniciar medição
          </button>
        </>
      );
    }
    if (status === "countdown") {
      return (
        <>
          <p style={{ marginTop: 8, fontSize: 18 }}>Prepare-se — mantenha-se imóvel</p>
          <div style={{ fontSize: 36, fontWeight: "bold", marginTop: 12 }}>{countdown}</div>
        </>
      );
    }
    if (status === "measuring") {
      return (
        <>
          <p style={{ marginTop: 8 }}>Medindo — mantenha-se relaxado e imóvel</p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginTop: 8 }}>
            <div className="spinner" style={{
              width: 36, height: 36, border: "4px solid rgba(0,0,0,0.1)", borderTop: "4px solid #007bff",
              borderRadius: 999
            }} />
            <div style={{ fontSize: 18 }}>{timeLeft}s</div>
          </div>
        </>
      );
    }
    // done
    return (
      <>
        <p style={{ marginTop: 8 }}>Medição finalizada. Resultados abaixo.</p>
        <button onClick={() => { setStatus("idle"); }} style={{ padding: "8px 12px", marginTop: 8 }}>
          Nova medição
        </button>
      </>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "20px auto", fontFamily: "system-ui, Arial" }}>
      <h3 style={{ textAlign: "center" }}>Medidor rPPG — Câmera</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
        <div>
          <video ref={videoRef} style={{ display: "none" }} autoPlay playsInline muted />
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "auto", borderRadius: 8, background: "#111" }}
          />
          <div style={{ textAlign: "center", marginTop: 12 }}>
            {renderControls()}
          </div>
        </div>

        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <strong>Resultados</strong>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div>BPM (suavizado): <strong>{bpm ? bpm.toFixed(1) : "..."}</strong></div>
            <div>BPM (bruto FFT): <strong>{bpmRaw ? bpmRaw.toFixed(1) : "..."}</strong></div>
            <div>Frequência (Hz): <strong>{freqHz ? freqHz.toFixed(3) : "..."}</strong></div>
            <div>HRV (SDNN ms): <strong>{hrv ? hrv.toFixed(1) : "..."}</strong></div>
            <div>SpO₂ (aprox): <strong>{spo2 ? spo2.toFixed(1) + "%" : "..."}</strong></div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
