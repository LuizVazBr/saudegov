"use client";

import { useEffect, useState, useCallback, useRef, useMemo, memo } from "react";
import {
  Activity, ArrowRight, Brain, Circle, ClipboardList, History as HistoryIcon,
  Map as MapIcon, Maximize2, Menu, MonitorPlay, Moon, Play, Shield, Sun, X, Settings,
  LocateFixed, Crosshair, ZoomIn, Info, Save, MapPin, User, ShieldAlert, Phone, Bot, Send, Mic, Loader2, ScrollText, Home, AlertTriangle, Search, Key, Globe, Clock, Calendar, ChevronDown, Check
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { useTheme } from "next-themes";
import { jsPDF } from "jspdf";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

const MapComponent = dynamic(() => import("./MapComponentPremium"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-200 dark:bg-[#0c0e14] animate-pulse" />
  )
});


/* =====================================================
   TYPES
===================================================== */
type TriageEvent = {
  id: string;
  pacienteId: string;
  paciente_nome?: string;
  descricao: string;
  classificacao: string;
  sintomas: any[];
  latitude: number;
  longitude: number;
  dataHora: string;
  origem?: string;
  sexo?: string;
  data_nascimento?: string;
  isNew?: boolean;
  unidade_id?: string;
  unit_lat?: number;
  unit_lng?: number;
};

type Unit = {
  id: string;
  nome: string;
  lat: number;
  lng: number;
  endereco?: string;
  imgUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  // Metrics
  totalTriagens: number;
  satisfacao: number;
  delays: number;
  complaints: number;
};

/* =====================================================
   UTILS
===================================================== */
const fmtTime = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const formatWaitTime = (minutes: number) => {
  if (minutes < 60) return `${Math.floor(minutes)} MIN`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}H${mins > 0 ? ` ${mins}M` : ''}`;
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return `${days}D${hours > 0 ? ` ${hours}H` : ''}`;
};

function DigitalClock() {
  const [time, setTime] = useState(fmtTime());
  useEffect(() => {
    const timer = setInterval(() => setTime(fmtTime()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="font-mono text-[10px] tracking-widest opacity-40">{time}</span>;
}

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getClassColor = (classificacao: string) => {
  switch (classificacao?.toLowerCase()) {
    case "azul": return "bg-blue-500";
    case "verde": return "bg-green-500";
    case "amarelo": return "bg-amber-500";
    case "laranja": return "bg-orange-500";
    case "vermelho": return "bg-red-600";
    default: return "bg-slate-400";
  }
};

// Registro Global (Singleton) para garantir que sintomas JAMAIS sumam da lista,
// mesmo se o componente desmontar ou se o filtro do servidor for restritivo.
const GLOBAL_SINTOMAS_REGISTRY = new Set<string>();

const DISEASE_CATALOG = [
  { name: "Dengue", symptoms: ["Febre", "Dor nas Articulações", "Dor Retro-orbital", "Manchas no corpo"], risk: "Amarelo" },
  { name: "Gripe", symptoms: ["Febre", "Tosse", "Dor de Garganta", "Dor no Corpo"], risk: "Amarelo" },
  { name: "COVID-19", symptoms: ["Febre", "Tosse Seca", "Cansaço", "Perda de Olfato"], risk: "Laranja" },
  { name: "Diabetes", symptoms: ["Sede excessiva", "Micção frequente", "Fadiga", "Visão turva"], risk: "Laranja" },
  { name: "Hipertensão", symptoms: ["Dor de cabeça", "Tontura", "Visão embaçada", "Palpitações"], risk: "Laranja" },
  { name: "Asma", symptoms: ["Falta de ar", "Chiado no peito", "Tosse", "Aperto no peito"], risk: "Amarelo" },
  { name: "Obesidade", symptoms: ["IMC elevado", "Cansaço", "Dificuldade respiratória"], risk: "Amarelo" },
  { name: "Insuficiência Renal", symptoms: ["Inchaço", "Diminuição da urina", "Fadiga", "Náusea"], risk: "Vermelho" },
  { name: "DPOC", symptoms: ["Tosse crônica", "Falta de ar", "Escarro"], risk: "Laranja" }
];

// Inicializa o registro com os sintomas do catálogo
DISEASE_CATALOG.forEach(d => d.symptoms.forEach(s => GLOBAL_SINTOMAS_REGISTRY.add(s.toString().trim())));

/* =====================================================
   COMPONENTS
===================================================== */

function TriageDetailsCard({ triage, onClose, maskName, maskDesc, privacyMode }: { triage: TriageEvent, onClose: () => void, maskName: (n?: string) => string, maskDesc: (d: string) => string, privacyMode: boolean }) {
  const handlePdfDownload = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.text("ANAMNEX - RELATÓRIO TÁTICO DE TRIAGEM", 20, 20);
    doc.setFont("helvetica", "normal");
    doc.text(`ID Ocorrência: ${triage.id}`, 20, 30);
    doc.text(`Paciente: ${triage.paciente_nome || 'N/A'}`, 20, 40);
    doc.text(`Data/Hora: ${new Date(triage.dataHora).toLocaleString()}`, 20, 50);
    doc.text(`Classificação: ${(triage.classificacao || "Verde").toUpperCase()}`, 20, 60);
    doc.text(`Relato: ${triage.descricao}`, 20, 70);
    doc.save(`Anamnex_Relatorio_${triage.id}.pdf`);
    toast.success("PDF gerado!");
  };

  const handleStrategicReport = () => {
    const doc = new jsPDF();
    const blue = "#0088ff";
    const now = new Date();
    
    // Header
    doc.setFillColor(blue);
    doc.rect(0, 0, 210, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("ANAMNEX", 20, 25);
    doc.setFontSize(12);
    doc.text("RELATÓRIO ESTRATÉGICO DE ATENDIMENTO", 20, 35);
    doc.setFontSize(8);
    doc.text(`DOCUMENTO GERADO EM: ${now.toLocaleString()}`, 20, 42);

    // Body
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text("RESUMO OPERACIONAL", 20, 65);
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 68, 190, 68);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO PACIENTE", 20, 80);
    doc.setFont("helvetica", "normal");
    doc.text(`NOME: ${triage.paciente_nome || "N/A"}`, 20, 88);
    doc.text(`ID TRIAGEM: ${triage.id}`, 20, 96);
    doc.text(`CLASSIFICAÇÃO: ${(triage.classificacao || "Verde").toUpperCase()}`, 20, 104);

    // Metrics Box
    doc.setFillColor(245, 247, 250);
    doc.rect(20, 115, 170, 40, 'F');
    
    const waitMin = (now.getTime() - new Date(triage.dataHora).getTime()) / 60000;
    const isAtendido = (triage.origem === 'finalizado' || false); // Simplificação
    
    const desc = (triage.descricao || "").toLowerCase();
    const hasComplaint = desc.includes("demora") || desc.includes("reclamação") || desc.includes("atraso") || desc.includes("não atendido");

    doc.setFont("helvetica", "bold");
    doc.text("INDICADORES DE FLUXO", 30, 125);
    doc.setFont("helvetica", "normal");
    doc.text(`TEMPO DE ESPERA: ${formatWaitTime(waitMin)}`, 30, 135);
    doc.text(`STATUS DE ATENDIMENTO: ${isAtendido ? "ATENDIDO" : "AGUARDANDO ATENDIMENTO"}`, 30, 143);
    
    doc.setTextColor(hasComplaint ? 200 : 0, 0, 0);
    doc.text(`RECLAMAÇÃO REGISTRADA: ${hasComplaint ? "SIM - VERIFICAR" : "NÃO DETECTADA"}`, 30, 151);

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text("Este relatório é confidencial e destinado à gestão de saúde. Versão 3.0 Anamnex Intell.", 105, 280, { align: 'center' });

    doc.save(`Relatorio_Estrategico_${triage.id}.pdf`);
    toast.success("Relatório gerado!");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.95 }}
      className="absolute bottom-10 right-10 w-full max-w-[420px] bg-white/95 dark:bg-[#0c0e14]/95 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-[3rem] shadow-2xl p-8 z-40 overflow-hidden m-4 sm:m-0"
    >
      <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-slate-300 dark:bg-white/20" />

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border text-white ${triage.classificacao.toLowerCase() === 'vermelho' ? 'bg-red-500 border-red-600' :
            triage.classificacao.toLowerCase() === 'laranja' ? 'bg-orange-500 border-orange-600' :
              triage.classificacao.toLowerCase() === 'amarelo' ? 'bg-amber-500 border-amber-600' :
                'bg-green-500 border-green-600'
            }`}>
            <Home size={28} />
          </div>
          <div>
            <h3 className="text-xl font-black font-mono tracking-tight uppercase text-slate-900 dark:text-white truncate max-w-[200px]">{maskName(triage.paciente_nome)}</h3>
            <p className="text-[10px] font-mono opacity-40 uppercase tracking-[0.3em] font-bold text-slate-900 dark:text-white">Triagem ID: {triage.id}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 transition-all border dark:border-white/10">
          <X size={20} className="text-slate-500" />
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-50 dark:bg-black/40 p-5 rounded-[2rem] border border-slate-200 dark:border-white/5">
          <p className="text-[10px] font-black font-mono opacity-40 uppercase mb-3 tracking-[0.2em] text-slate-900 dark:text-white">Resumo Clínico {privacyMode && <Shield className="inline w-3 h-3 ml-1 text-blue-500" />}</p>
          <p className="text-[14px] font-mono font-black italic opacity-85 leading-relaxed text-slate-900 dark:text-white line-clamp-4">"{maskDesc(triage.descricao)}"</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-black/40 p-5 rounded-[2rem] border border-slate-200 dark:border-white/5 flex flex-col items-center">
            <AlertTriangle size={20} className={`${triage.classificacao.toLowerCase() === 'vermelho' ? 'text-red-500' : 'text-amber-500'
              } mb-2`} />
            <p className="text-[9px] font-black font-mono opacity-40 uppercase text-slate-900 dark:text-white">Classificação</p>
            <p className="text-xs font-black font-mono uppercase text-[#0088ff]">{triage.classificacao}</p>
          </div>
          <div className="bg-white dark:bg-black/40 p-5 rounded-[2rem] border border-slate-200 dark:border-white/5 flex flex-col items-center">
            <Activity size={20} className="text-[#0088ff] mb-2" />
            <p className="text-[9px] font-black font-mono opacity-40 uppercase text-slate-900 dark:text-white">Tempo de Espera</p>
            <p className="text-xs font-black font-mono uppercase text-[#0088ff]">
              {formatWaitTime((Date.now() - new Date(triage.dataHora).getTime()) / 60000)}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handlePdfDownload}
            className="flex-1 py-4 rounded-[2rem] bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black font-mono uppercase hover:bg-slate-100 dark:hover:bg-white/10 transition-all text-slate-900 dark:text-white"
          >
            PDF
          </button>
          <button 
            onClick={handleStrategicReport}
            className="flex-[2] py-4 rounded-[2rem] bg-[#0088ff] text-white text-[11px] font-black font-mono uppercase shadow-[0_15px_40px_rgba(0,136,255,0.3)] hover:scale-[1.02] active:scale-95 transition-all tracking-[0.2em]"
          >
            Abrir Relatório
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function UnitDetailsCard({ unit, onClose }: { unit: Unit, onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.95 }}
      className="absolute bottom-10 right-10 w-full max-w-[420px] bg-white/95 dark:bg-[#0c0e14]/95 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-[3rem] shadow-2xl z-40 overflow-hidden m-4 sm:m-0 flex flex-col max-h-[85vh]"
    >
      <div className="w-12 h-1.5 bg-slate-300 dark:bg-white/20 rounded-full mx-auto my-4 flex-shrink-0" />

      <div className="relative h-44 sm:h-52 bg-slate-200 dark:bg-white/5 overflow-hidden flex-shrink-0">
        {unit.imgUrl ? (
          <img src={unit.imgUrl} className="w-full h-full object-cover" alt={unit.nome} />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20 bg-gradient-to-br from-[#0088ff]/20 to-transparent">
            <Home size={60} />
          </div>
        )}
        <button onClick={onClose} className="absolute top-4 right-6 bg-black/50 hover:bg-black/70 w-8 h-8 rounded-full flex items-center justify-center text-white transition-all z-10">
          <X size={16} />
        </button>
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent">
          <h2 className="text-xl font-black font-mono text-white uppercase tracking-tight truncate">{unit.nome}</h2>
          <p className="text-white/60 text-[10px] font-mono flex items-center gap-2 mt-1 uppercase tracking-tighter">
            <MapPin size={12} /> {unit.endereco}
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-3xl border border-slate-200 dark:border-white/10">
            <p className="text-[9px] font-black font-mono opacity-40 uppercase tracking-widest mb-1">Demanda</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black font-mono text-[#0088ff] leading-none">{unit.totalTriagens}</span>
              <span className="text-[10px] font-bold opacity-30 uppercase">Pacientes</span>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-3xl border border-slate-200 dark:border-white/10">
            <p className="text-[9px] font-black font-mono opacity-40 uppercase tracking-widest mb-1">Satisfação</p>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black font-mono leading-none ${unit.satisfacao > 80 ? 'text-green-500' : unit.satisfacao > 50 ? 'text-amber-500' : 'text-red-500'}`}>
                {unit.satisfacao}%
              </span>
            </div>
          </div>
        </div>

        {unit.audioUrl && (
          <div className="bg-[#0088ff]/5 p-5 rounded-3xl border border-[#0088ff]/20">
            <p className="text-[9px] font-black font-mono text-[#0088ff] uppercase tracking-widest mb-3 flex items-center gap-2">
              <Mic size={14} /> ÁUDIO DESCRITIVO
            </p>
            <audio controls className="w-full h-8">
              <source src={unit.audioUrl} type="audio/mpeg" />
            </audio>
          </div>
        )}

        <div className="flex gap-3">
          <button className="flex-1 py-4 rounded-2xl bg-[#0088ff] text-white text-[10px] font-black font-mono uppercase shadow-lg shadow-blue-500/20 tracking-[0.2em] hover:scale-[1.02] transition-all">
            Gestão Fluxo
          </button>
          <button onClick={onClose} className="px-6 py-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/40 text-[10px] font-black font-mono uppercase border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
            Voltar
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const TriageCard = memo(({ triage, active, onClick, maskName, maskDesc }: { triage: TriageEvent, active?: boolean, onClick: () => void, maskName: (n?: string) => string, maskDesc: (d: string) => string }) => {
  const isNewGlow = triage.isNew ? "ring-2 ring-[#0088ff] shadow-[0_0_40px_rgba(0,136,255,0.4)]" : "";
  const cls = (triage.classificacao || "Verde").toLowerCase();

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return "N/A";
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return `${age} anos`;
  };

  const colorClass =
    cls === 'vermelho' ? 'bg-red-600' :
      cls === 'laranja' ? 'bg-orange-500' :
        cls === 'amarelo' ? 'bg-amber-500' :
          'bg-green-600';

  return (
    <div
      onClick={onClick}
      className={`p-5 mx-6 mb-4 rounded-3xl transition-all duration-300 group cursor-pointer border
      ${isNewGlow}
      ${active ? 'border-[#0088ff] bg-[#0088ff]/10 shadow-[0_0_30px_rgba(0,136,255,0.15)] scale-[1.02]' : 'bg-white dark:bg-black/20 border-slate-200/80 dark:border-white/5 hover:border-[#0088ff]/40 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-black/40 hover:shadow-lg'}`}>

      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono opacity-40 uppercase tracking-[0.2em]">{new Date(triage.dataHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <div className="flex items-center gap-3">
          {triage.origem === 'voz' && (
            <div className="w-6 h-6 rounded-full bg-[#0088ff]/10 flex items-center justify-center text-[#0088ff] animate-pulse">
              <Mic size={12} />
            </div>
          )}
          <span className="text-[14px] font-black font-mono text-[#0088ff] whitespace-nowrap">
            {formatWaitTime((Date.now() - new Date(triage.dataHora).getTime()) / 60000)}
          </span>
          <div className={`px-3 py-1 rounded ${colorClass} text-[9px] font-black font-mono tracking-widest text-white uppercase shadow-lg`}>
            {triage.classificacao}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="text-[13px] font-black font-mono uppercase text-slate-900 dark:text-white truncate max-w-[150px]">{maskName(triage.paciente_nome)}</h4>
        <div className="flex items-center gap-2 text-[8px] font-mono font-black opacity-30 uppercase tracking-tighter text-slate-400">
          <span>{triage.sexo || "N/I"}</span>
          <span className="w-1 h-1 rounded-full bg-slate-400" />
          <span>{calculateAge(triage.data_nascimento)}</span>
        </div>
        <p className="text-[9px] font-mono opacity-30 uppercase tracking-tighter text-slate-400">ID: {triage.id}</p>
        <p className="text-[11px] font-mono opacity-50 dark:text-white line-clamp-1 italic mt-2">"{maskDesc(triage.descricao)}"</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {(triage.sintomas || []).slice(0, 6).map((s, i) => {
          const sName = typeof s === 'string' ? s : (s?.nome || 'Sintoma');
          return (
            <span key={i} className="text-[7.5px] font-black font-mono uppercase text-white bg-black dark:bg-white/5 px-2 py-0.5 rounded-full border border-white/10 shadow-sm">
              {sName}
            </span>
          );
        })}
      </div>
    </div>
  );
});

const SearchControls = memo(({
  search,
  setSearch,
  isSearching,
  filterSexo,
  setFilterSexo,
  selectedSintomas,
  setSelectedSintomas,
  uniqueSintomas,
  diseaseCatalog
}: {
  search: string,
  setSearch: (s: string) => void,
  isSearching: boolean,
  filterSexo: string,
  setFilterSexo: (s: string) => void,
  selectedSintomas: string[],
  setSelectedSintomas: (s: string[]) => void,
  uniqueSintomas: string[],
  diseaseCatalog: any[]
}) => {
  const [isSymptomDropdownOpen, setIsSymptomDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSymptomDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleSintoma = (s: string) => {
    if (!s) return;
    const sStr = s.toString();
    // Busca insensitiva para garantir que o catálogo funcione com o que vem do banco
    const normalizedSelected = (selectedSintomas || []).map(item => (item || "").toString().toLowerCase().trim());
    const sNormalized = sStr.toLowerCase().trim();

    if (normalizedSelected.includes(sNormalized)) {
      setSelectedSintomas(selectedSintomas.filter(item => (item || "").toString().toLowerCase().trim() !== sNormalized));
    } else {
      setSelectedSintomas([...(selectedSintomas || []), sStr]);
    }
  };

  const isChecked = (s: string) => {
    if (!s) return false;
    const sStr = s.toString().toLowerCase().trim();
    return (selectedSintomas || []).some(item => (item || "").toString().toLowerCase().trim() === sStr);
  };

  return (
    <div className="px-6 mb-8 space-y-6">
      {/* Catálogo de Patologias */}
      <div className="space-y-3">
        <h3 className="text-[9px] font-black font-mono opacity-40 uppercase tracking-[0.2em] flex items-center gap-2">
          <Activity size={12} className="text-[#0088ff]" /> Catálogo de Patologias
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
          {diseaseCatalog.map((d, i) => {
            const normalizedSelected = (selectedSintomas || []).map(s => s.toString().toLowerCase().trim());
            const normalizedPathology = (d.symptoms || []).map(s => s.toString().toLowerCase().trim());
            const isActive = normalizedSelected.length === normalizedPathology.length && 
                             normalizedPathology.every(s => normalizedSelected.includes(s));

            return (
              <button
                key={i}
                onClick={() => {
                  if (isActive) {
                    setSelectedSintomas([]);
                  } else {
                    setSelectedSintomas(d.symptoms);
                  }
                }}
                className={`flex-shrink-0 px-4 py-3 rounded-2xl border transition-all text-left min-w-[140px] group ${
                  isActive 
                  ? 'bg-[#0088ff] border-[#0088ff] shadow-[0_10px_25px_rgba(0,136,255,0.3)]' 
                  : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-[#0088ff] hover:bg-[#0088ff]/5'
                }`}
              >
                <p className={`text-[10px] font-black font-mono uppercase transition-colors ${
                  isActive ? 'text-white' : 'text-slate-800 dark:text-white group-hover:text-[#0088ff]'
                }`}>
                  {d.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]' : (
                      d.risk === 'Vermelho' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                      d.risk === 'Laranja' ? 'bg-orange-500' :
                      'bg-amber-500'
                    )
                  }`} />
                  <p className={`text-[7px] font-mono uppercase transition-colors ${
                    isActive ? 'text-white/70' : 'opacity-40'
                  }`}>
                    {d.symptoms.length} Indicadores
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#0088ff] transition-colors" />
        <input 
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="BUSCAR PROTOCOLO/PACIENTE..."
          className="w-full h-[54px] bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl pl-12 pr-4 text-xs font-black font-mono focus:outline-none focus:ring-2 focus:ring-[#0088ff] transition-all text-slate-900 dark:text-white shadow-md"
        />
        {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#0088ff]" />}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <select 
          value={filterSexo}
          onChange={(e) => setFilterSexo(e.target.value)}
          className="h-[54px] bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-6 text-xs font-black font-mono focus:outline-none focus:ring-2 focus:ring-[#0088ff] transition-all text-slate-800 dark:text-white/80 cursor-pointer shadow-md"
        >
          <option value="all">TODOS GENEROS</option>
          <option value="Masculino">MASCULINO</option>
          <option value="Feminino">FEMININO</option>
        </select>

        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsSymptomDropdownOpen(!isSymptomDropdownOpen)}
            className="w-full h-[54px] bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl px-6 text-xs font-black font-mono text-left flex items-center justify-between hover:border-[#0088ff]/50 transition-all text-slate-800 dark:text-white/80 shadow-md"
          >
            <span className="truncate">
              {selectedSintomas.length === 0 ? "TODOS SINTOMAS" : `${selectedSintomas.length} SELECIONADOS`}
            </span>
            <ChevronDown size={14} className={`transition-transform duration-300 ${isSymptomDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
           <AnimatePresence>
            {isSymptomDropdownOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#0c0e14] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden p-2 max-h-[400px] flex flex-col"
              >
                {selectedSintomas.length > 0 && (
                  <button 
                    onClick={() => setSelectedSintomas([])}
                    className="w-full py-3 mb-2 text-xs font-black font-mono uppercase text-red-500 hover:bg-red-500/10 transition-colors border-b border-slate-200 dark:border-white/5"
                  >
                    Limpar Filtros
                  </button>
                )}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-1 min-h-[50px]">
                  {(uniqueSintomas || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 opacity-30">
                      <Search size={24} className="mb-2" />
                      <p className="text-[10px] font-black font-mono">AGUARDANDO DADOS...</p>
                    </div>
                  ) : (uniqueSintomas || []).map((s, idx) => {
                    if (!s) return null;
                    const sStr = s.toString();
                    return (
                      <label 
                        key={`${sStr}-${idx}`} 
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors group"
                      >
                        <input 
                          type="checkbox" 
                          checked={isChecked(sStr)}
                          onChange={() => toggleSintoma(sStr)}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                          isChecked(sStr) 
                          ? 'bg-[#0088ff] border-[#0088ff]' 
                          : 'border-slate-300 dark:border-white/20 group-hover:border-[#0088ff]'
                        }`}>
                          {isChecked(sStr) && <Check size={12} className="text-white" />}
                        </div>
                        <span className="text-xs font-black font-mono uppercase text-slate-800 dark:text-white/70 group-hover:text-[#0088ff] transition-colors">{sStr}</span>
                      </label>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});

/* =====================================================
   HELPER COMPONENTS
===================================================== */

function UnitNetworkList({ unidades, onFocus }: { unidades: any[], onFocus: (u: any) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-[10px] font-mono opacity-50 uppercase mb-4 tracking-widest">Monitoramento de Capacidade e Satisfação</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {unidades.map(u => (
          <div key={u.id} className="p-5 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-xs font-black uppercase text-[#0088ff]">{u.nome || "Unidade"}</h4>
                <p className="text-[8px] opacity-40 uppercase font-mono truncate max-w-[150px]">{u.endereco || "Sem endereço"}</p>
              </div>
              <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${u.satisfacao > 80 ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
                {u.satisfacao > 80 ? 'Estável' : 'Atenção'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="p-3 rounded-2xl bg-white dark:bg-black/20 border border-slate-100 dark:border-white/5">
                <p className="text-[7px] font-black opacity-30 uppercase mb-1">Satisfação</p>
                <p className="text-sm font-black font-mono text-[#0088ff]">{u.satisfacao}%</p>
              </div>
              <div className="p-3 rounded-2xl bg-white dark:bg-black/20 border border-slate-100 dark:border-white/5">
                <p className="text-[7px] font-black opacity-30 uppercase mb-1">Demanda</p>
                <p className="text-sm font-black font-mono text-[#0088ff]">{u.totalTriagens}</p>
              </div>
            </div>
            <button
              onClick={() => onFocus(u)}
              className="w-full py-2 rounded-xl bg-slate-200 dark:bg-white/10 text-[8px] font-black uppercase hover:bg-[#0088ff] hover:text-white transition-all mt-2"
            >
              Ver no Mapa
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsContent({ onClose }: { onClose: () => void }) {
  const [dStart, setDStart] = useState(new Date().toISOString().split('T')[0]);
  const [dEnd, setDEnd] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [chartsData, setChartsData] = useState<{
    sexo: any[],
    sintomas: any[],
    transcricao: any[]
  }>({ sexo: [], sintomas: [], transcricao: [] });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const processChartsData = (rawData: any[]) => {
    const sexCounts = rawData.reduce((acc: any, h) => {
      const s = String(h.sexo || "Não informado").toUpperCase();
      if (s.startsWith("M")) acc.m++;
      else if (s.startsWith("F")) acc.f++;
      else acc.o++;
      return acc;
    }, { m: 0, f: 0, o: 0 });

    const sexoData = [
      { name: "MASCULINO", value: sexCounts.m, color: "#0088ff" },
      { name: "FEMININO", value: sexCounts.f, color: "#f472b6" },
      { name: "OUTRO", value: sexCounts.o, color: "#94a3b8" }
    ].filter(d => d.value > 0);

    const symptomMap: Record<string, number> = {};
    rawData.forEach(h => {
      (h.sintomas || []).forEach((s: any) => {
        const name = (s.nome || s).toString().toUpperCase();
        if (name) symptomMap[name] = (symptomMap[name] || 0) + 1;
      });
    });
    const sintomasData = Object.entries(symptomMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const transData = rawData
      .filter(h => h.tempo_transcricao != null)
      .map((h, i) => ({
        name: h.paciente_nome?.split(' ')[0] || `T${i}`,
        value: Number(h.tempo_transcricao)
      }))
      .slice(0, 10);

    setChartsData({ sexo: sexoData, sintomas: sintomasData, transcricao: transData });
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/historico-all?limit=500&dataInicio=${dStart}&dataFim=${dEnd}`);
      const result = await res.json();
      const rows = Array.isArray(result) ? result : [];
      setData(rows);
      processChartsData(rows);
    } catch (err) {
      toast.error("Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (data.length === 0) return;
    const doc = new jsPDF();
    const blue = "#0088ff";
    doc.setFillColor(blue);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("SAÚDE INTELIGENTE - MONITORAMENTO ESTRATÉGICO", 20, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("PAINEL OPERACIONAL DE AUDITORIA E VIGILÂNCIA", 20, 30);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text("RELATÓRIO OPERACIONAL DE ATENDIMENTOS", 20, 55);
    doc.setFontSize(9);
    doc.text(`PERÍODO: ${new Date(dStart).toLocaleDateString("pt-BR")} ATÉ ${new Date(dEnd).toLocaleDateString("pt-BR")}`, 20, 65);
    doc.text(`DATA DE EMISSÃO: ${new Date().toLocaleString("pt-BR")}`, 20, 70);
    const total = data.length;
    const finalizados = data.filter(d => (d.status || "").toLowerCase() === 'finalizado').length;
    const atendidosPer = total > 0 ? ((finalizados / total) * 100).toFixed(1) : 0;
    doc.setFillColor(245, 247, 250);
    doc.rect(20, 80, 170, 25, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL TRIAGENS: ${total}`, 30, 95);
    doc.text(`TAXA DE RESOLUTIVIDADE: ${atendidosPer}%`, 100, 95);
    let y = 120;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("DATA", 20, y);
    doc.text("PACIENTE", 60, y);
    doc.text("CLASSIFICAÇÃO", 120, y);
    doc.text("STATUS", 160, y);
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y + 2, 190, y + 2);
    y += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    data.slice(0, 25).forEach(item => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(new Date(item.data_cadastro).toLocaleDateString("pt-BR"), 20, y);
      doc.text(item.paciente_nome?.substring(0, 25) || "N/A", 60, y);
      doc.text(item.classificacao || "Verde", 120, y);
      doc.text(item.status || "Iniciado", 160, y);
      y += 8;
    });
    doc.save(`Relatorio_SaudeInteligente_${Date.now()}.pdf`);
    toast.success("Relatório gerado!");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase opacity-40 ml-2">Início</label>
          <input type="date" value={dStart} onChange={e => setDStart(e.target.value)} className="w-full h-11 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 text-xs font-mono outline-none" />
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase opacity-40 ml-2">Fim</label>
          <input type="date" value={dEnd} onChange={e => setDEnd(e.target.value)} className="w-full h-11 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 text-xs font-mono outline-none" />
        </div>
      </div>

      <button onClick={fetchReports} disabled={loading} className="w-full h-14 rounded-[2rem] bg-slate-200 dark:bg-white/10 text-[10px] font-mono font-black uppercase hover:bg-[#0088ff] hover:text-white transition-all flex items-center justify-center gap-3">
        {loading ? "PROCESSANDO..." : "CARREGAR RELATÓRIO ESTRATÉGICO"} <Activity size={18} />
      </button>

      {isMounted && data.length > 0 && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="grid grid-cols-1 gap-8">
            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-8 rounded-[2.5rem] overflow-hidden">
              <h4 className="text-[10px] font-black font-mono uppercase tracking-[0.2em] opacity-40 mb-8 flex items-center gap-2"><User size={14} /> GÊNERO</h4>
              <div className="h-[300px] w-full" style={{ minWidth: 0, minHeight: 300 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
                  <PieChart>
                    <Pie 
                      data={chartsData.sexo} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={70} 
                      outerRadius={100} 
                      paddingAngle={8} 
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {chartsData.sexo.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#02040a', border: 'none', borderRadius: '16px', fontSize: '10px' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-8 rounded-[2.5rem] overflow-hidden">
              <h4 className="text-[10px] font-black font-mono uppercase tracking-[0.2em] opacity-40 mb-8 flex items-center gap-2"><Activity size={14} /> SINTOMAS</h4>
              <div className="h-[300px] w-full" style={{ minWidth: 0, minHeight: 400 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
                  <BarChart data={chartsData.sintomas} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 9, fill: '#888' }} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: '#02040a', border: 'none', borderRadius: '16px', fontSize: '10px' }} />
                    <Bar dataKey="value" fill="#0088ff" radius={[0, 6, 6, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-8 rounded-[2.5rem] overflow-hidden">
              <h4 className="text-[10px] font-black font-mono uppercase tracking-[0.2em] opacity-40 mb-8 flex items-center gap-2"><Clock size={14} /> TRANSCRIÇÃO</h4>
              <div className="h-[250px] w-full" style={{ minWidth: 0, minHeight: 250 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
                  <BarChart data={chartsData.transcricao}>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#888' }} />
                    <YAxis tick={{ fontSize: 9, fill: '#888' }} />
                    <Tooltip contentStyle={{ background: '#02040a', border: 'none', borderRadius: '16px', fontSize: '10px' }} />
                    <Bar dataKey="value" fill="#22c55e" radius={[6, 6, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="space-y-6 pt-6">
            <h4 className="text-[11px] font-black font-mono uppercase tracking-[0.3em] opacity-30 px-2">OCORRÊNCIAS</h4>
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar border border-slate-200 dark:border-white/5 rounded-[2rem] bg-white/50 dark:bg-black/20">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-[#0c0e14] z-10">
                  <tr><th className="p-5 text-[8px] font-black uppercase opacity-40">Data</th><th className="p-5 text-[8px] font-black uppercase opacity-40">Paciente</th><th className="p-5 text-[8px] font-black uppercase opacity-40">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {data.slice(0, 20).map((item, i) => (
                    <tr key={i} className="text-[10px] hover:bg-[#0088ff]/5 transition-all group">
                      <td className="p-5 font-mono opacity-60">{new Date(item.data_cadastro).toLocaleDateString("pt-BR")}</td>
                      <td className="p-5 font-black uppercase flex items-center gap-3"><div className={`w-2 h-2 rounded-full shadow-lg ${getClassColor(item.classificacao)}`} />{item.paciente_nome?.substring(0, 20)}</td>
                      <td className="p-5"><span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase ${(item.status || '').toLowerCase() === 'finalizado' ? 'bg-green-500/10 text-green-500' : 'bg-[#0088ff]/10 text-[#0088ff]'}`}>{item.status || "Iniciado"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={generatePDF} className="w-full py-6 rounded-[2.5rem] bg-[#0088ff] text-white font-mono font-black text-[11px] uppercase shadow-2xl shadow-blue-500/40 flex items-center justify-center gap-4 hover:scale-[1.01] transition-all">Relatório PDF <ScrollText size={20} /></button>
          </div>
        </div>
      )}
      <button onClick={onClose} className="w-full py-6 text-[9px] font-black uppercase opacity-30 hover:opacity-100 transition-opacity font-mono tracking-widest">— FINALIZAR SESSÃO —</button>
    </div>
  );
}

function SettingsContent({ settings, onSave, onClose, modoTeste, onToggleModoTeste }: { settings: any, onSave: (s: any) => void, onClose: () => void, modoTeste: boolean, onToggleModoTeste: (v: boolean) => void }) {
  const [local, setLocal] = useState(settings);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase opacity-40 ml-2">Latitude Inicial</label>
          <input
            type="number"
            step="0.0001"
            value={local.lat}
            onChange={e => setLocal({ ...local, lat: parseFloat(e.target.value) })}
            className="w-full h-11 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 text-xs font-mono focus:outline-none focus:border-[#0088ff]"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase opacity-40 ml-2">Longitude Inicial</label>
          <input
            type="number"
            step="0.0001"
            value={local.lng}
            onChange={e => setLocal({ ...local, lng: parseFloat(e.target.value) })}
            className="w-full h-11 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 text-xs font-mono focus:outline-none focus:border-[#0088ff]"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase opacity-40 ml-2">Zoom Inicial</label>
          <input
            type="number"
            value={local.zoom}
            onChange={e => setLocal({ ...local, zoom: parseInt(e.target.value) })}
            className="w-full h-11 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 text-xs font-mono focus:outline-none focus:border-[#0088ff]"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase opacity-40 ml-2">Tema Padrão</label>
          <select
            value={local.theme}
            onChange={e => setLocal({ ...local, theme: e.target.value })}
            className="w-full h-11 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl px-4 text-xs font-mono focus:outline-none focus:border-[#0088ff]"
          >
            <option value="dark">DARK</option>
            <option value="satellite">SATÉLITE</option>
            <option value="hybrid">HÍBRIDO</option>
            <option value="light">LIGHT</option>
          </select>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-white/10">
        <label className="flex items-center justify-between cursor-pointer group p-3 rounded-2xl hover:bg-slate-200/50 dark:hover:bg-white/5 transition-all">
          <div className="flex flex-col">
            <span className="text-[11px] font-black font-mono uppercase text-[#0088ff] group-hover:text-blue-400 transition-colors">Ativar Modo Teste</span>
            <span className="text-[9px] font-mono opacity-40 uppercase">Usa tabela unidades_teste</span>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              checked={modoTeste}
              onChange={(e) => onToggleModoTeste(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-slate-300 dark:bg-white/10 rounded-full peer peer-checked:bg-[#0088ff] transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 shadow-inner" />
          </div>
        </label>
      </div>

      <div className="pt-4 flex gap-3">
        <button
          onClick={() => { onSave(local); onClose(); toast.success("Configurações aplicadas!"); }}
          className="flex-1 py-4 rounded-2xl bg-[#0088ff] text-white font-mono font-black text-[10px] uppercase shadow-lg shadow-blue-500/20"
        >
          Salvar Preferências
        </button>
        <button
          onClick={onClose}
          className="px-8 py-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 font-mono font-black text-[10px] uppercase"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
export default function RealTimeDashboard() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"triagens" | "unidades">("triagens");
  const [activeLayer, setActiveLayer] = useState("dark");
  const [selectedTriage, setSelectedTriage] = useState<TriageEvent | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  const [feedTriages, setFeedTriages] = useState<TriageEvent[]>([]);
  const [mapTriages, setMapTriages] = useState<TriageEvent[]>([]);
  const [unidadesRaw, setUnidadesRaw] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const [globalStats, setGlobalStats] = useState({ total: 0, criticos: 0 });
  const loaderRef = useRef<HTMLDivElement>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [modalContent, setModalContent] = useState<{ title: string, icon: any, children: React.ReactNode } | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [mapFocus, setMapFocus] = useState<{ lat: number, lng: number, zoom: number, ts: number } | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [filterSexo, setFilterSexo] = useState<string>("all");
  const [selectedSintomas, setSelectedSintomas] = useState<string[]>([]);
  const [allSintomas, setAllSintomas] = useState<string[]>([]);
  const [showFeedMobile, setShowFeedMobile] = useState(false);

  const [mapSettings, setMapSettings] = useState({
    lat: -15.7801,
    lng: -47.9292,
    zoom: 12,
    theme: "dark"
  });
  const [modoTeste, setModoTeste] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("cliv_modo_teste") === "true";
    }
    return false;
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'cliv_modo_teste') {
        const val = e.newValue === 'true';
        setModoTeste(val);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleModoTeste = (ativo: boolean) => {
    setModoTeste(ativo);
    localStorage.setItem("cliv_modo_teste", ativo ? "true" : "false");
    window.dispatchEvent(new StorageEvent('storage', { key: 'cliv_modo_teste', newValue: ativo ? 'true' : 'false' }));
    toast.success(ativo ? "Modo teste ativado" : "Modo teste desativado");
  };

  useEffect(() => {
    const saved = localStorage.getItem("anamnex_gestor_map_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMapSettings(parsed);
        if (parsed.theme) setActiveLayer(parsed.theme);
      } catch (e) { console.error(e); }
    }
  }, []);

  const saveMapSettings = (newSettings: typeof mapSettings) => {
    setMapSettings(newSettings);
    localStorage.setItem("anamnex_gestor_map_settings", JSON.stringify(newSettings));
    if (newSettings.theme) setActiveLayer(newSettings.theme);
    setMapFocus({
      lat: newSettings.lat,
      lng: newSettings.lng,
      zoom: newSettings.zoom,
      ts: Date.now()
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Efeito de DESCOBERTA: Alimenta o Registro Global com tudo o que chega nos triagens brutos (Mapa)
  useEffect(() => {
    if (!Array.isArray(mapTriages)) return;
    
    let changed = false;
    mapTriages.forEach(t => {
      if (t && Array.isArray(t.sintomas)) {
        t.sintomas.forEach(s => {
          if (!s) return;
          const name = (typeof s === 'object' ? (s.nome || '') : s).toString().trim();
          if (name) {
            const normalized = name.toLowerCase();
            let exists = false;
            // Busca case-insensitive no Set global
            for (let existing of GLOBAL_SINTOMAS_REGISTRY) {
              if (existing.toLowerCase() === normalized) {
                exists = true;
                break;
              }
            }
            if (!exists) {
              GLOBAL_SINTOMAS_REGISTRY.add(name);
              changed = true;
            }
          }
        });
      }
    });

    if (changed || allSintomas.length === 0) {
      setAllSintomas(Array.from(GLOBAL_SINTOMAS_REGISTRY).sort((a, b) => a.localeCompare(b)));
    }
  }, [mapTriages]);

  // Sincronização inicial
  useEffect(() => {
    setAllSintomas(Array.from(GLOBAL_SINTOMAS_REGISTRY).sort((a, b) => a.localeCompare(b)));
  }, []);

  const [chatMsgs, setChatMsgs] = useState<{ role: 'user' | 'bot', content: string, action?: string }[]>([
    { role: 'bot', content: 'Olá! Posso coletar informações sobre triagens recentes, classificações de risco ou disponibilidade de unidades.' }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const [privacyMode, setPrivacyMode] = useState(true);
  const [isHeatmap, setIsHeatmap] = useState(false);

  const maskName = (name?: string) => {
    if (!name || name === "PACIENTE ANÔNIMO") {
      return privacyMode ? "P•••••" : "ANÔNIMO";
    }
    if (!privacyMode) return name;
    return name.charAt(0).toUpperCase() + "•••••";
  };

  const maskDesc = (text: string) => {
    if (!privacyMode) return text;
    return "CONTEÚDO PROTEGIDO (LGPD) • DESCRIÇÃO SUPRIMIDA PARA AUDITORIA";
  };

  const recognitionRef = useRef<any>(null);

  const forceAudioCapture = async () => {
    if (!("webkitSpeechRecognition" in window)) {
      toast.error("O reconhecimento de voz não é suportado neste navegador.");
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognitionRef.current = recognition;
      
      recognition.lang = "pt-BR";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsRecording(true);
        toast.success("Ouvindo...", { id: "voice-chat" });
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join("");
        setChatInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Erro no reconhecimento:", event.error);
        setIsRecording(false);
        toast.error("Erro ao captar voz.");
      };

      recognition.onend = () => {
        setIsRecording(false);
        toast.dismiss("voice-chat");
      };

      recognition.start();
    } catch (err) {
      console.error("Erro ao iniciar reconhecimento:", err);
      setIsRecording(false);
    }
  };
  const [isRecording, setIsRecording] = useState(false);


  const fetchFeed = useCallback(async (pageNum: number, isNewSearch: boolean = false) => {
    if (loadingRef.current || (!hasMoreRef.current && !isNewSearch)) return;

    loadingRef.current = true;
    setLoadingMore(true);
    if (isNewSearch) setIsSearching(true);

    try {
      const sintomasParam = selectedSintomas.length > 0 ? selectedSintomas.join(',') : 'all';
      const res = await fetch(`/api/historico-all?page=${pageNum}&limit=20&search=${debouncedSearch}&sexo=${filterSexo}&sintoma=${sintomasParam}&teste=${modoTeste}&v=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      const result = await res.json();
      const data = result.rows || result;

      if (Array.isArray(data)) {
        const isLastPage = data.length < 20;
        setHasMore(!isLastPage);
        hasMoreRef.current = !isLastPage;

        const formatted = data.map((t: any) => ({
          ...t,
          id: String(t.id),
          latitude: typeof t.latitude === 'string' ? parseFloat(t.latitude) : t.latitude,
          longitude: typeof t.longitude === 'string' ? parseFloat(t.longitude) : t.longitude,
          unit_lat: typeof t.unit_lat === 'string' ? parseFloat(t.unit_lat) : t.unit_lat,
          unit_lng: typeof t.unit_lng === 'string' ? parseFloat(t.unit_lng) : t.unit_lng,
          dataHora: t.data_cadastro
        }));
        setFeedTriages(prev => isNewSearch ? formatted : [...prev, ...formatted]);
      }
    } catch (err) {
      console.error("Erro no feed:", err);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
      setIsSearching(false);
    }
  }, [debouncedSearch, filterSexo, selectedSintomas, modoTeste]);

  useEffect(() => {
    if (!mapBounds) return;
    const b = mapBounds;
    fetch(`/api/historico-all?page=1&limit=100&teste=${modoTeste}&v=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(result => {
        const data = result.rows || result;
        if (Array.isArray(data)) {
          const formatted = data.map((t: any) => ({
            ...t,
            id: String(t.id),
            latitude: typeof t.latitude === 'string' ? parseFloat(t.latitude) : t.latitude,
            longitude: typeof t.longitude === 'string' ? parseFloat(t.longitude) : t.longitude,
            unit_lat: typeof t.unit_lat === 'string' ? parseFloat(t.unit_lat) : t.unit_lat,
            unit_lng: typeof t.unit_lng === 'string' ? parseFloat(t.unit_lng) : t.unit_lng,
            dataHora: t.data_cadastro
          }));
          setMapTriages(formatted);
        }
      });
  }, [mapBounds, modoTeste]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        setPage(prev => {
          const next = prev + 1;
          fetchFeed(next);
          return next;
        });
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, fetchFeed]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    hasMoreRef.current = true;
    fetchFeed(1, true);
  }, [debouncedSearch, filterSexo, selectedSintomas, modoTeste]);

  useEffect(() => {
    setMounted(true);

    fetch(`/api/unidades?teste=${modoTeste}&refresh=true&v=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setUnidadesRaw(data);
      });

    const refreshStats = () => {
      fetch("/api/stats/global", {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      })
        .then(res => res.json())
        .then(stats => {
          if (stats && typeof stats.total === 'number') {
            setGlobalStats(stats);
          }
        })
        .catch(err => console.error("Erro ao hidratar stats:", err));
    };

    refreshStats();
    const statsInterval = setInterval(refreshStats, 30000);

    const eventSource = new EventSource("/api/real-time/stream");
    eventSource.onmessage = (event) => {
      const newTriage = JSON.parse(event.data);
      if (newTriage.latitude && newTriage.longitude) {
        const triage: TriageEvent = {
          id: newTriage.id ? String(newTriage.id) : Math.random().toString(),
          pacienteId: String(newTriage.pacienteId || ""),
          paciente_nome: newTriage.paciente_nome,
          descricao: newTriage.descricao,
          classificacao: newTriage.classificacao || "Verde",
          sintomas: newTriage.sintomas || [],
          latitude: newTriage.latitude,
          longitude: newTriage.longitude,
          unit_lat: newTriage.unit_lat,
          unit_lng: newTriage.unit_lng,
          dataHora: new Date().toISOString(),
          isNew: true
        };

        setFeedTriages(prev => [triage, ...prev]);
        setMapTriages(prev => [triage, ...prev]);

        setGlobalStats(prev => ({
          total: (prev.total || 0) + 1,
          criticos: ((triage.classificacao || "").toLowerCase() === 'vermelho') ? (prev.criticos || 0) + 1 : (prev.criticos || 0)
        }));
        setMapFocus({ lat: triage.latitude, lng: triage.longitude, zoom: 17, ts: Date.now() });

        toast.success(`NOVA TRIAGEM: ${maskName(triage.paciente_nome)}`, {
          style: { background: '#02040a', color: '#fff', border: '1px solid #0088ff', fontSize: '12px', fontWeight: 'bold' }
        });
      }
    };

    return () => { eventSource.close(); clearInterval(statsInterval); };
  }, [modoTeste]);

  const generateCruzeiroPDF = () => {
    const doc = new jsPDF();
    const blue = "#0088ff";
    
    // Header
    doc.setFillColor(blue);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("ANAMNEX - RELATÓRIO DE COMPLAINTS", 20, 25);
    doc.setFontSize(10);
    doc.text("UNIDADE: UBS DO CRUZEIRO", 20, 35);

    // Body
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text("DETALHAMENTO DAS RECLAMAÇÕES (Nomes Suprimidos - LGPD)", 20, 55);
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 58, 190, 58);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Reclamação 01:", 20, 75);
    doc.setFont("helvetica", "normal");
    doc.text("- Paciente: P••••• (ID RE-0129)", 25, 83);
    doc.text("- Assunto: Demora excessiva no atendimento de triagem.", 25, 90);
    doc.text("- Data: " + new Date().toLocaleDateString(), 25, 97);

    doc.setFont("helvetica", "bold");
    doc.text("Reclamação 02:", 20, 115);
    doc.setFont("helvetica", "normal");
    doc.text("- Paciente: M••••• (ID RE-0144)", 25, 123);
    doc.text("- Assunto: Falta de medicamentos básicos na farmácia da unidade.", 25, 130);
    doc.text("- Data: " + new Date().toLocaleDateString(), 25, 137);

    // Context
    doc.setFillColor(245, 247, 250);
    doc.rect(20, 150, 170, 30, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("RECOMENDAÇÃO GESTORA:", 30, 162);
    doc.setFont("helvetica", "normal");
    doc.text("Necessária auditoria no fluxo de triagem e revisão de estoque.", 30, 170);

    doc.save("Relatorio_Reclamacoes_Cruzeiro.pdf");
    toast.success("PDF gerado com sucesso!");
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatMsgs(prev => [...prev, { role: 'user', content: msg }]);
    setChatInput("");
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const lowerMsg = msg.toLowerCase();
      
      if (lowerMsg.includes("cruzeiro") && (lowerMsg.includes("reclamação") || lowerMsg.includes("reclamações"))) {
        setChatMsgs(prev => [...prev, { 
          role: 'bot', 
          content: 'Sim, há 2 reclamações, uma sobre demora no atendimento e outra de falta de medicamento.',
          action: 'pdf_cruzeiro'
        }]);
      } else if (lowerMsg.includes("guará") && (lowerMsg.includes("reclamação") || lowerMsg.includes("reclamações"))) {
        setChatMsgs(prev => [...prev, { role: 'bot', content: 'Não. Há poucos atendimentos. A taxa de satisfação é de 80%.' }]);
      } else if (lowerMsg.includes("vermelho") || lowerMsg.includes("emergência")) {
        setChatMsgs(prev => [...prev, { role: 'bot', content: 'Identifiquei 2 triagens em estado critico (Vermelho) nos últimos 15 minutos. Deseja visualizar no mapa?' }]);
      } else {
        setChatMsgs(prev => [...prev, { role: 'bot', content: 'Analisando dados globais... O fluxo da UPA Central está com tempo de espera de 45 minutos.' }]);
      }
    }, 1000);
  };

  const unidades = useMemo(() => {
    if (!Array.isArray(unidadesRaw)) return [];
    
    // Otimização: Agrupa triagens por proximidade grosseira primeiro se houver muitas
    const tNodes = mapTriages.map(t => ({
      ...t,
      lat: t.latitude,
      lng: t.longitude,
      time: new Date(t.dataHora).getTime()
    }));

    return unidadesRaw.map(u => {
      const unitLat = parseFloat(u.lat);
      const unitLng = parseFloat(u.lng);

      // Usar filtro mais direto para performance
      const mappedTriages = tNodes.filter(t => {
        // Ignorar se não houver coordenadas
        if (t.lat == null || t.lng == null) return false;
        // Filtro rápido por bounding box (~10km) antes de calcular distância real (mais pesado)
        if (Math.abs(t.lat - unitLat) > 0.1 || Math.abs(t.lng - unitLng) > 0.1) return false;
        const dist = getDistance(t.lat, t.lng, unitLat, unitLng);
        return dist < 10;
      });

      let delays = 0;
      let complaints = 0;
      const now = Date.now();

      mappedTriages.forEach(t => {
        const waitTime = (now - t.time) / 60000;
        if (waitTime > 20) delays++;

        const desc = (t.descricao || "").toLowerCase();
        if (desc.includes("não atendido") || desc.includes("demora") || desc.includes("reclamação") || desc.includes("superlotado")) {
          complaints++;
        }
      });

      let satisfacao = Math.max(0, 100 - (delays * 10) - (complaints * 10));
      
      // Força a satisfação de 80% para a UBS 01 Guará conforme solicitado para a demonstração
      if (u.nome?.toUpperCase().includes("GUARA") || u.nome?.toUpperCase().includes("GUARÁ")) {
        satisfacao = 80;
      }

      return {
        ...u,
        lat: unitLat,
        lng: unitLng,
        totalTriagens: mappedTriages.length,
        delays,
        complaints,
        satisfacao
      } as Unit;
    });
  }, [unidadesRaw, mapTriages]);

  const filteredFeedTriages = useMemo(() => {
    if (!Array.isArray(feedTriages)) return [];
    return feedTriages.filter(t => {
      if (!t) return false;
      const matchSexo = filterSexo === "all" || (t.sexo || "").toString().toLowerCase() === filterSexo.toLowerCase();
      
      // Busca insensitiva para garantir que o catálogo funcione
      const matchSintoma = (selectedSintomas || []).length === 0 || selectedSintomas.every(sel => {
        if (!sel) return true;
        const selNorm = sel.toString().toLowerCase().trim();
        return (t.sintomas || []).some(s => {
          if (!s) return false;
          const sNorm = (typeof s === 'object' ? (s.nome || '') : s).toString().toLowerCase().trim();
          return sNorm === selNorm;
        });
      });
      return matchSexo && matchSintoma;
    });
  }, [feedTriages, filterSexo, selectedSintomas]);

  const filteredMapTriages = useMemo(() => {
    if (!Array.isArray(mapTriages)) return [];
    return mapTriages.filter(t => {
      if (!t) return false;
      const matchSexo = filterSexo === "all" || (t.sexo || "").toString().toLowerCase() === filterSexo.toLowerCase();

      // Busca insensitiva para garantir que o catálogo funcione
      const matchSintoma = (selectedSintomas || []).length === 0 || selectedSintomas.every(sel => {
        if (!sel) return true;
        const selNorm = sel.toString().toLowerCase().trim();
        return (t.sintomas || []).some(s => {
          if (!s) return false;
          const sNorm = (typeof s === 'object' ? (s.nome || '') : s).toString().toLowerCase().trim();
          return sNorm === selNorm;
        });
      });
      return matchSexo && matchSintoma;
    });
  }, [mapTriages, filterSexo, selectedSintomas]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-[#02040a] relative text-slate-900 dark:text-white font-sans overflow-hidden transition-all duration-500">

      <header className="h-[70px] sticky top-0 z-[60] px-8 flex items-center justify-between bg-white/90 dark:bg-black/80 backdrop-blur-3xl border-b border-slate-200 dark:border-white/5 shadow-xl">
        <div className="flex items-center gap-6">
          <button
            onClick={() => router.push('/saudegov')}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-[#0088ff] hover:bg-white dark:hover:bg-[#0088ff]/10 transition-all group"
            title="Voltar ao Início"
          >
            <ArrowRight size={20} className="rotate-180" />
          </button>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl bg-[#0088ff] flex items-center justify-center text-white shadow-lg shadow-blue-500/30 ${true ? 'hidden' : ''}`}>
              <Shield size={24} />
            </div>
            <h1 className="text-2xl font-black tracking-tight uppercase font-mono leading-none">MAPA DE ATENDIMENTOS</h1>
            <p className="text-[10px] tracking-[0.4em] opacity-40 font-mono uppercase hidden lg:block">SAÚDE INTELIGENTE</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="hidden sm:flex items-center gap-12 border-r border-slate-200 dark:border-white/10 pr-12">
            {[
              { l: 'ATENDIMENTOS', v: globalStats.total },
              { l: 'CRÍTICOS', v: globalStats.criticos }
            ].map(s => (
              <div key={s.l} className="text-center">
                <p className="text-sm font-black font-mono text-[#0088ff]">{s.v}</p>
                <p className="text-[9px] font-mono opacity-40 uppercase tracking-[0.2em] font-black">{s.l}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-3">
              <button
                onClick={() => setPrivacyMode(!privacyMode)}
                className={`p-3 rounded-2xl border transition-all flex items-center gap-2 ${privacyMode ? 'bg-[#0088ff] border-blue-400 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/40 hover:bg-slate-200 dark:hover:bg-white/10'}`}
                title={privacyMode ? "Privacidade Ativa (LGPD)" : "Desativar Privacidade"}
              >
                {privacyMode ? <Shield size={20} /> : <ShieldAlert size={20} />}
                <span className="text-[10px] font-black font-mono uppercase tracking-tighter">{privacyMode ? "LGPD ATIVA" : "PRIVACIDADE OFF"}</span>
              </button>

              <button
                onClick={() => setIsHeatmap(!isHeatmap)}
                className={`p-3 rounded-2xl border transition-all flex items-center gap-2 ${isHeatmap ? 'bg-orange-600 border-orange-400 text-white shadow-lg shadow-orange-500/20' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/40 hover:bg-slate-200 dark:hover:bg-white/10'}`}
              >
                <Activity size={20} />
                <span className="text-[10px] font-black font-mono uppercase tracking-tighter">MAPA CALOR</span>
              </button>
            </div>

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-white/10 mx-2" />

            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/80 hover:bg-slate-200 dark:hover:bg-white/10 transition-all font-mono text-[10px] flex items-center gap-2"
            >
              {mounted && theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              <span>TEMA</span>
            </button>

            <button
              onClick={() => { setIsChatOpen(!isChatOpen); setIsMenuOpen(false); setShowFeedMobile(false); }}
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${isChatOpen ? 'bg-[#0088ff] border-[#0088ff] shadow-[0_0_15px_#0088ff60]' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-[#0088ff]/20'}`}
            >
              <Bot size={20} className={isChatOpen ? 'text-white' : 'text-[#0088ff]'} />
            </button>


            <button
              onClick={() => { setIsMenuOpen(!isMenuOpen); setIsChatOpen(false); setShowFeedMobile(false); }}
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${isMenuOpen ? 'bg-[#0088ff] border-[#0088ff]' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-[#0088ff]/20'}`}
            >
              {isMenuOpen ? <X size={20} className="text-white" /> : <Menu size={20} className="text-[#0088ff]" />}
            </button>
          </div>
        </div>
      </header>

      <div className={`fixed top-[70px] right-0 h-[calc(100vh-70px)] w-80 bg-white/95 dark:bg-[#0c0e14]/95 backdrop-blur-3xl shadow-2xl border-l border-slate-200 dark:border-white/5 z-[70] transform transition-transform duration-500 ease-out flex flex-col ${isMenuOpen ? 'translate-x-0' : 'translate-x-[100%]'}`}>
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <h3 className="text-[11px] font-black font-mono uppercase tracking-[0.3em] opacity-40 mb-6 flex items-center gap-3">
            <Activity size={16} className="text-[#0088ff]" /> Monitoramento
          </h3>
          <div className="flex flex-col gap-4">
            {[
              { label: "Dashboard Geral", icon: Home },
              { label: "Relatórios", icon: ScrollText },
              { label: "Rede de Unidades", icon: MapIcon }
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setModalContent({
                    title: item.label,
                    icon: item.icon,
                    children: item.label === "Rede de Unidades" ? (
                      <UnitNetworkList
                        unidades={unidades}
                        onFocus={(u) => {
                          setMapFocus({ lat: u.lat, lng: u.lng, zoom: 18, ts: Date.now() });
                          setModalContent(null);
                        }}
                      />
                    ) : item.label === "Relatórios" ? (
                      <ReportsContent onClose={() => setModalContent(null)} />
                    ) : (
                      <div className="space-y-6 text-slate-900 dark:text-white">
                        <div className="p-6 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                          <p className="text-xs font-mono opacity-60 leading-relaxed mb-4">Esta funcionalidade de <strong>{item.label}</strong> permite a gestão estratégica e auditoria de recursos para otimizar o fluxo de atendimento.</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                              <p className="text-[9px] font-black uppercase mb-1">Status</p>
                              <p className="text-xs font-bold font-mono">ESTÁVEL / 100%</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-[#0088ff]/10 border border-[#0088ff]/20 text-[#0088ff]">
                              <p className="text-[9px] font-black uppercase mb-1">Rede</p>
                              <p className="text-xs font-bold font-mono">CONECTADO</p>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setModalContent(null)}
                          className="w-full py-4 rounded-2xl bg-[#0088ff] text-white font-mono font-black text-[10px] uppercase shadow-lg shadow-blue-500/20"
                        >
                          Confirmar Visualização
                        </button>
                      </div>
                    )
                  });
                  setIsMenuOpen(false);
                }}
                className="w-full py-4 px-6 rounded-2xl bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-[11px] font-black font-mono uppercase flex justify-between items-center hover:bg-slate-50 dark:hover:bg-[#0088ff]/10 hover:border-[#0088ff]/50 transition-all shadow-sm group"
              >
                <span className="flex items-center gap-3">
                  <item.icon size={18} className="text-[#0088ff]" />
                  {item.label}
                </span>
                <ArrowRight size={16} className="text-[#0088ff] group-hover:translate-x-1 transition-transform" />
              </button>
            ))}
          </div>

          {false && (
            <div className="mt-8 pt-8 border-t border-slate-200 dark:border-white/5">
              <h3 className="text-[11px] font-black font-mono uppercase tracking-[0.3em] opacity-40 mb-6 flex items-center gap-3">
                <ShieldAlert size={16} className="text-[#0088ff]" /> Controle e Simulação
              </h3>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => {
                    const mockId = "ad461b95-e3b7-4d50-b9c6-54e33313a2d4";
                    const triage: TriageEvent = {
                      id: mockId,
                      pacienteId: "ece6551c-71ff-4033-92d8-d995b61d1a4d",
                      paciente_nome: "SIMULAÇÃO - PACIENTE CRÍTICO",
                      descricao: "Simulação de ocorrência crítica disparada via terminal Anamnex. Paciente com dor torácica aguda e sudorese.",
                      classificacao: "Vermelho",
                      sintomas: [{ nome: "Dor no Peito" }, { nome: "Sudorese" }],
                      latitude: -15.7942 + (Math.random() - 0.5) * 0.1,
                      longitude: -47.8822 + (Math.random() - 0.5) * 0.1,
                      dataHora: new Date().toISOString(),
                      isNew: true
                    };
                    setFeedTriages(prev => [triage, ...prev]);
                    setMapTriages(prev => [triage, ...prev]);
                    setGlobalStats(prev => ({ total: prev.total + 1, criticos: prev.criticos + 1 }));
                    setMapFocus({ lat: triage.latitude, lng: triage.longitude, zoom: 17, ts: Date.now() });
                    setSelectedTriage(triage);
                    setIsMenuOpen(false);
                    toast.error("SIMULAÇÃO: Alerta Crítico Detectado!", { duration: 5000 });
                  }}
                  className="w-full py-4 px-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 text-[11px] font-black font-mono uppercase flex justify-between items-center hover:bg-red-500/20 transition-all shadow-sm"
                >
                  Simular Triagem Crítica <Play size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 p-6 rounded-3xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <p className="text-[10px] font-black font-mono opacity-40 uppercase tracking-[0.2em] mb-4">Configurações de Visualização</p>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer group p-3 rounded-2xl hover:bg-slate-200/50 dark:hover:bg-white/5 transition-all">
                <span className="text-[11px] font-black font-mono uppercase text-slate-600 dark:text-slate-400 group-hover:text-[#0088ff] transition-colors">Privacidade Ativa (LGPD)</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={privacyMode}
                    onChange={() => setPrivacyMode(!privacyMode)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-300 dark:bg-white/10 rounded-full peer peer-checked:bg-[#0088ff] transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 shadow-inner" />
                </div>
              </label>
              <label className="flex items-center justify-between cursor-pointer group p-3 rounded-2xl hover:bg-slate-200/50 dark:hover:bg-white/5 transition-all">
                <span className="text-[11px] font-black font-mono uppercase text-slate-600 dark:text-slate-400 group-hover:text-orange-500 transition-colors">Mapa de Calor</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={isHeatmap}
                    onChange={() => setIsHeatmap(!isHeatmap)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-300 dark:bg-white/10 rounded-full peer peer-checked:bg-orange-600 transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 shadow-inner" />
                </div>
              </label>
            </div>
          </div>

          <button
            onClick={() => {
              setModalContent({
                title: "Configurações do Sistema",
                icon: Settings,
                children: (
                  <SettingsContent 
                    settings={mapSettings} 
                    onSave={saveMapSettings} 
                    onClose={() => setModalContent(null)} 
                    modoTeste={modoTeste}
                    onToggleModoTeste={toggleModoTeste}
                  />
                )
              });
              setIsMenuOpen(false);
            }}
            className="w-full py-4 px-6 rounded-2xl bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-[11px] font-black font-mono uppercase flex justify-between items-center hover:bg-slate-50 dark:hover:bg-[#0088ff]/10 hover:border-[#0088ff]/50 transition-all shadow-sm"
          >
            Configurações <Settings size={16} />
          </button>
        </div>
      </div>

      <div className={`fixed top-[70px] right-0 h-[calc(100vh-70px)] w-full sm:w-[450px] bg-white/95 dark:bg-[#02040a]/95 backdrop-blur-3xl shadow-[-20px_0_50px_rgba(0,0,0,0.1)] border-l border-slate-200 dark:border-white/5 z-[70] transform transition-transform duration-500 ease-out flex flex-col ${isChatOpen ? 'translate-x-0' : 'translate-x-[100%]'}`}>
        <div className="p-6 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 flex items-center justify-between">
          <div>
            <h3 className="text-[13px] font-black font-mono uppercase tracking-widest flex items-center gap-3">
              <Bot size={20} className="text-[#0088ff]" /> ASSISTENTE
            </h3>
            <p className="text-[10px] font-mono opacity-50 mt-1 uppercase tracking-widest pl-8 text-slate-400">Varredura de Dados Operacionais</p>
          </div>
          <button onClick={() => setIsChatOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32">
          {chatMsgs.map((m, i) => (
            <div key={i} className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${m.role === 'user' ? 'bg-[#0088ff] text-white rounded-tr-sm shadow-blue-500/20' : 'bg-slate-100 dark:bg-[#0c0e14] border border-slate-200 dark:border-white/5 rounded-tl-sm'}`}>
                <p className="text-[12px] font-mono leading-relaxed">{m.content}</p>
                {m.action === 'pdf_cruzeiro' && (
                  <button 
                    onClick={generateCruzeiroPDF}
                    className="mt-4 w-full py-3 rounded-xl bg-[#0088ff] text-white text-[10px] font-black font-mono uppercase shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
                  >
                    <ScrollText size={14} /> Baixar Relatório de Reclamações
                  </button>
                )}
              </div>
            </div>
          ))}
          {isTyping && <div className="text-[10px] font-mono opacity-50 animate-pulse pl-2">Assistente analisando...</div>}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-[#02040a] via-white dark:via-[#02040a] to-transparent">
          <form onSubmit={handleChatSubmit} className="flex gap-2 items-center">
            <div className="relative flex-1 group">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Como posso ajudar agora?"
                className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-6 pr-6 text-sm font-mono focus:outline-none focus:border-[#0088ff] transition-all group-hover:border-[#0088ff]/40"
              />
            </div>

            <div className="relative group">
              <button
                type="button"
                onClick={forceAudioCapture}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 border overflow-hidden ${isRecording
                  ? 'bg-red-500 border-red-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse'
                  : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-[#0088ff] hover:bg-[#0088ff]/10 hover:border-[#0088ff]/50'
                  }`}
              >
                <Mic size={20} />
              </button>
              {!isRecording && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 text-white text-[9px] font-black font-mono uppercase rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
                  Fale agora
                </div>
              )}
              {isRecording && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-red-600 text-white text-[9px] font-black font-mono uppercase rounded-lg opacity-100 whitespace-nowrap shadow-xl">
                  Microfone em uso
                </div>
              )}
            </div>

            <button type="submit" className="w-12 h-12 rounded-2xl bg-[#0088ff] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all shadow-blue-500/30">
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* Bottom Sheet Modal */}
      <AnimatePresence>
        {modalContent && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalContent(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto z-[101] bg-white dark:bg-[#0c0e14] border-t border-x border-slate-200 dark:border-white/10 rounded-t-[3rem] shadow-[0_-20px_60px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]"
            >
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-white/20 rounded-full mx-auto my-6 flex-shrink-0" />
              <div className="px-10 pb-12 overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-[#0088ff]/10 flex items-center justify-center text-[#0088ff] border border-[#0088ff]/20">
                    {modalContent.icon && <modalContent.icon size={28} />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black font-mono uppercase tracking-tight text-slate-900 dark:text-white">{modalContent.title}</h2>
                    <p className="text-[10px] font-black font-mono opacity-40 uppercase tracking-[0.2em]">Gestão Operacional Anamnex • v3.0</p>
                  </div>
                  <button onClick={() => setModalContent(null)} className="ml-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 transition-all border dark:border-white/10 text-slate-500">
                    <X size={20} />
                  </button>
                </div>
                {modalContent.children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex h-[calc(100vh-70px)] overflow-hidden">

        <aside className={`w-full lg:w-[380px] flex-col border-r border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-[#02040a] z-40 transition-all duration-300
          ${showFeedMobile ? 'flex fixed inset-y-[70px] left-0 h-[calc(100vh-70px)] bg-white dark:bg-[#02040a]' : 'hidden lg:flex'}`}>
          <div className="p-6 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
            <div className="bg-slate-200/50 dark:bg-white/5 p-1 rounded-xl flex gap-1 mb-6">
              <button
                onClick={() => setSidebarTab("triagens")}
                className={`flex-1 py-2 text-[9px] font-black font-mono uppercase rounded-lg transition-all ${sidebarTab === 'triagens' ? 'bg-[#0088ff] text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-[#0088ff]'}`}
              >
                Tempo Real
              </button>
              <button
                onClick={() => setSidebarTab("unidades")}
                className={`flex-1 py-2 text-[9px] font-black font-mono uppercase rounded-lg transition-all ${sidebarTab === 'unidades' ? 'bg-[#0088ff] text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-[#0088ff]'}`}
              >
                Últimas Atualizações
              </button>
            </div>

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[11px] font-black font-mono uppercase tracking-[0.4em] opacity-40">FEED</h2>
              <DigitalClock />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pt-4">
            {sidebarTab === 'triagens' ? (
              <>
                <SearchControls
                  search={search}
                  setSearch={setSearch}
                  isSearching={isSearching}
                  filterSexo={filterSexo}
                  setFilterSexo={setFilterSexo}
                  selectedSintomas={selectedSintomas}
                  setSelectedSintomas={setSelectedSintomas}
                  uniqueSintomas={allSintomas}
                  diseaseCatalog={DISEASE_CATALOG}
                />

                {filteredFeedTriages.length === 0 && !loadingMore && !isSearching && (
                  <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center px-10">
                    <Search size={48} className="mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">Nenhuma ocorrência encontrada para os filtros aplicados</p>
                  </div>
                )}

                {filteredFeedTriages.map((t, idx) => (
                  <TriageCard
                    key={t.id + '-' + idx}
                    triage={t}
                    onClick={() => {
                      setSelectedTriage(t);
                      setMapFocus({ lat: t.latitude, lng: t.longitude, zoom: 18, ts: Date.now() });
                      setShowFeedMobile(false);
                    }}
                    active={selectedTriage?.id === t.id}
                    maskName={maskName}
                    maskDesc={maskDesc}
                  />
                ))}
              </>
            ) : (
              <div className="px-6 space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <Activity size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-emerald-500">Fluxo Operacional</p>
                    <p className="text-[9px] opacity-40 font-mono">ESTABILIZADO • SEM ALERTAS CRÍTICOS</p>
                  </div>
                </div>

                {feedTriages.slice(0, 10).map((t, idx) => (
                  <div
                    key={`update-${t.id}`}
                    onClick={() => {
                      setSelectedTriage(t);
                      setMapFocus({ lat: t.latitude, lng: t.longitude, zoom: 18, ts: Date.now() });
                      setShowFeedMobile(false);
                    }}
                    className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 relative overflow-hidden group cursor-pointer hover:bg-slate-50 dark:hover:bg-[#0088ff]/10 transition-all"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#0088ff] opacity-40" />
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-mono opacity-30 uppercase">{new Date(t.dataHora).toLocaleTimeString()}</span>
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-[#0088ff]/10 text-[#0088ff] uppercase">{t.classificacao}</span>
                    </div>
                    <p className="text-[11px] font-bold leading-tight line-clamp-2">Nova Triagem registrada: {maskName(t.paciente_nome)}</p>
                    <p className="text-[9px] opacity-40 mt-1 uppercase font-mono tracking-tighter">Lat: {t.latitude?.toFixed(4) || "0.0000"} / Lng: {t.longitude?.toFixed(4) || "0.0000"}</p>
                  </div>
                ))}
              </div>
            )}

            {hasMore && (
              <div ref={loaderRef} className="py-10 flex justify-center">
                <Loader2 className="animate-spin text-[#0088ff]" size={24} />
              </div>
            )}
            {!hasMore && feedTriages.length > 0 && (
              <div className="py-10 text-center text-[10px] font-black font-mono opacity-30 uppercase tracking-[0.3em]">
                Sem mais resultados
              </div>
            )}
          </div>
        </aside>

        <section className="flex-1 relative">
          <MapComponent
            triages={filteredMapTriages}
            unidades={unidades}
            selectedTriageId={selectedTriage?.id || null}
            onNodeClick={(id) => {
              const tri = mapTriages.find(t => t.id === id);
              if (tri) setSelectedTriage(tri);
              const uni = unidades.find(u => u.id === id);
              if (uni) setSelectedUnit(uni);
            }}
            onBoundsChange={setMapBounds}
            currentLayer={activeLayer}
            eventFocus={mapFocus}
            isHeatmap={isHeatmap}
            privacyMode={privacyMode}
            initialCenter={[mapSettings.lat, mapSettings.lng]}
            initialZoom={mapSettings.zoom}
          />

          {/* LAYER SWITCHER PILL */}
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-[50] bg-white/90 dark:bg-[#0c0e14]/90 backdrop-blur-3xl border border-slate-200 dark:border-white/10 rounded-[2rem] p-1.5 shadow-2xl ${showFeedMobile ? 'hidden lg:flex' : 'flex'}`}>
            {[
              { id: "dark", label: "Dark" },
              { id: "satellite", label: "Satélite" },
              { id: "hybrid", label: "Híbrido" },
              { id: "light", label: "Light" }
            ].map((layer) => (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                className={`px-5 py-2.5 rounded-2xl text-[10px] font-black font-mono uppercase transition-all ${activeLayer === layer.id
                  ? "bg-[#0088ff] text-white shadow-[0_5px_20px_rgba(0,136,255,0.4)]"
                  : "text-slate-400 hover:text-[#0088ff]"
                  }`}
              >
                {layer.label}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {selectedTriage && (
              <TriageDetailsCard
                triage={selectedTriage}
                maskName={maskName}
                maskDesc={maskDesc}
                privacyMode={privacyMode}
                onClose={() => setSelectedTriage(null)}
              />
            )}
            {selectedUnit && (
              <UnitDetailsCard
                unit={selectedUnit}
                onClose={() => setSelectedUnit(null)}
              />
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* MOBILE FLOATING TOGGLE BUTTON (FAB) */}
      <div className="lg:hidden fixed bottom-10 left-1/2 -translate-x-1/2 z-[80]">
        <button
          onClick={() => { setShowFeedMobile(!showFeedMobile); setIsMenuOpen(false); setIsChatOpen(false); }}
          className={`flex items-center gap-3 px-8 py-4 rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.3)] border-2 transition-all active:scale-95
          ${showFeedMobile
              ? 'bg-white dark:bg-[#0c0e14] border-[#0088ff] text-[#0088ff]'
              : 'bg-[#0088ff] border-[#0088ff] text-white shadow-[#0088ff]/30'
            }`}
        >
          {showFeedMobile ? (
            <>
              <MapIcon size={20} />
              <span className="text-xs font-black font-mono uppercase tracking-widest">Ver Mapa</span>
            </>
          ) : (
            <>
              <ClipboardList size={20} />
              <span className="text-xs font-black font-mono uppercase tracking-widest">Ver Feed</span>
            </>
          )}
        </button>
      </div>

      <style jsx global>{`
        .leaflet-container { background: #02040a !important; }
        .map-tiles-dark-premium { filter: brightness(1.6) contrast(1.1) saturate(0.5) !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 136, 255, 0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
}
