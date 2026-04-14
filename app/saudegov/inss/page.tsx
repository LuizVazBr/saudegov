"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FiChevronLeft, FiSearch, FiUser, FiActivity, FiMap, FiFilter, FiCheckCircle, FiExternalLink, FiDollarSign
} from "react-icons/fi";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";
import dynamic from "next/dynamic";

// Importação dinâmica do Mapa para evitar erros de SSR com Leaflet
const InssPopulationMap = dynamic(() => import("@/components/InssPopulationMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 dark:bg-white/5 animate-pulse rounded-[2rem] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 opacity-20">
        <FiMap size={48} />
        <p className="text-xs font-black uppercase tracking-widest">Carregando Inteligência Geográfica...</p>
      </div>
    </div>
  )
});

export default function INSSHub() {
  const router = useRouter();
  const [cpf, setCpf] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  // Mapa States
  const [units, setUnits] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [triages, setTriages] = useState<any[]>([]);
  const [loadingMap, setLoadingMap] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<any>(null);
  
  // Filtros
  const [filters, setFilters] = useState({
    disease: "all",
    risk: "all",
    unitType: "all"
  });

  const [mapCenter, setMapCenter] = useState<[number, number]>([-15.7942, -47.8822]);
  const [mapZoom, setMapZoom] = useState(11);

  useEffect(() => {
    async function fetchMapData() {
      try {
        const res = await fetch('/api/saudegov/inss/mapa');
        const data = await res.json();
        setUnits(data.units || []);
        setPatients(data.patients || []);
        setTriages(data.triages || []);
      } catch (err) {
        console.error("Erro ao carregar mapa:", err);
      } finally {
        setLoadingMap(false);
      }
    }
    fetchMapData();
  }, []);

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCPF(e.target.value));
  };

  const handleSearch = async () => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast.error("CPF Inválido. Digite 11 dígitos.");
      return;
    }
    setIsSearching(true);
    setResult(null);

    try {
      const res = await fetch(`/api/saudegov/inss/search?cpf=${cleanCpf}`);
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || "Erro na consulta.");
      } else {
        setResult(data);
        toast.success("Dados vinculados com sucesso!");
        if (data.patient?.lat && data.patient?.lng) {
            setMapCenter([data.patient.lat, data.patient.lng]);
            setMapZoom(16);
        }
      }
    } catch (err) {
      toast.error("Falha na conexão com o servidor.");
    } finally {
      setIsSearching(false);
    }
  };

  const regionalStats = useMemo(() => {
    if (!patients.length) return null;
    if (selectedRegion?.type === 'unit') {
        return {
            title: selectedRegion.nome,
            total: selectedRegion.metrics.totalPatients,
            risk: selectedRegion.status,
            cost: selectedRegion.metrics.totalPatients * 1200,
            predominant: "Diabetes"
        };
    }
    return {
        title: "Visão Geral - Araguaína",
        total: patients.length,
        risk: "Moderado",
        cost: patients.reduce((acc, p) => acc + (p.custo_estimado || 0), 0),
        predominant: "Hipertensão"
    };
  }, [patients, selectedRegion]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#02040a] text-slate-900 dark:text-white font-sans selection:bg-[#0088ff]/30">
      <Toaster position="top-right" />
      
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#0c0e14]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-8 py-5">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => router.push('/saudegov')} className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-[#0088ff] hover:text-white transition-all text-slate-500 group">
              <FiChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-black flex items-center gap-3"><FiMap className="text-emerald-500" /> Inteligência Populacional</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Monitoramento Federal • <span className="text-[#0088ff]">INSS / TCU</span></p>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-4">
             <div className="flex flex-col items-end">
                <p className="text-[10px] font-black opacity-30 uppercase tracking-widest">Custo Estimado (Região)</p>
                <p className="text-xl font-black text-[#0088ff]">R$ {(regionalStats?.cost || 0).toLocaleString('pt-BR')}</p>
             </div>
             <div className="w-[1px] h-10 bg-slate-200 dark:bg-white/10 mx-2" />
             <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> DADOS AO VIVO
             </div>
          </div>
        </div>
      </header>

      <main className="pt-32 h-[calc(100vh)] flex gap-6 px-8 pb-8 overflow-hidden">
        <aside className="w-full max-w-[450px] h-[calc(100vh-160px)] flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-4">
           <section className="p-8 rounded-[32px] bg-white dark:bg-[#0c0e14] border border-slate-200 dark:border-white/10 shadow-xl relative group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><FiSearch size={100} /></div>
              <h3 className="text-sm font-black uppercase tracking-widest mb-6 opacity-40">CPF</h3>
              <div className="space-y-4">
                 <div className="relative">
                    <FiUser className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" value={cpf} onChange={handleCpfChange} placeholder="000.000.000-00" className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 focus:ring-[#0088ff] transition-all" />
                 </div>
                 <button onClick={handleSearch} disabled={isSearching} className="w-full py-4 rounded-2xl bg-[#0088ff] text-white font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all">
                    {isSearching ? "Consultando..." : "BUSCAR AGORA"}
                 </button>
              </div>

              <AnimatePresence>
                 {result && (
                   <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-8 pt-8 border-t border-slate-200 dark:border-white/5 space-y-6">
                     <div className="flex justify-between items-start">
                        <div>
                           <h4 className="font-black text-sm">{result.patient.nome}</h4>
                           <p className="text-[10px] font-mono opacity-40">{result.patient.cpf}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${result.stats.riskLevel === 'Crítico' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-[#0088ff]/10 text-[#0088ff] border-blue-500/20'}`}>Risco {result.stats.riskLevel}</span>
                     </div>

                     {result.intel && (
                       <div className="p-5 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                          <div className="flex items-center gap-2 mb-3">
                             <div className="p-1.5 rounded-lg bg-orange-500 text-white"><FiActivity size={12} /></div>
                             <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Inteligência: {result.intel.condicao_detectada}</span>
                          </div>
                          <p className="text-[11px] font-bold text-orange-700 dark:text-white mb-4">{result.intel.historico_crm}</p>
                          <div className="space-y-2">
                             <p className="text-[9px] font-black uppercase opacity-40">Roadmap de Acompanhamento</p>
                             {result.intel.acompanhamento.map((item: string, i: number) => (
                                <div key={i} className="flex items-start gap-2 text-[10px] font-medium leading-relaxed">
                                   <FiCheckCircle className="shrink-0 mt-0.5 text-emerald-500" /> {item}
                                </div>
                             ))}
                          </div>
                       </div>
                     )}

                     <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/5 text-[11px] leading-relaxed italic border-l-2 border-[#0088ff] dark:text-slate-300">
                        {result.analise.conclusao}
                     </div>

                     {/* 🏥 HISTÓRICO REAL DE TRIAGENS */}
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40">Atendimentos Registrados</h4>
                           <span className="text-[9px] font-bold text-[#0088ff]">{result.historicoResumido.length} registros</span>
                        </div>
                        
                        <div className="space-y-3">
                           {result.historicoResumido.map((t: any, idx: number) => (
                             <div key={idx} className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-[#0088ff]/30 transition-colors">
                                <div className="flex justify-between items-center mb-2">
                                   <span className="text-[10px] font-black opacity-30 italic">
                                      {new Date(t.data_cadastro).toLocaleDateString('pt-BR')}
                                   </span>
                                   <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase ${
                                     t.classificacao === 'Vermelho' ? 'bg-red-500 text-white' : 
                                     t.classificacao === 'Laranja' ? 'bg-orange-500 text-white' : 
                                     t.classificacao === 'Amarelo' ? 'bg-yellow-500 text-black' : 'bg-green-500 text-white'
                                   }`}>
                                      {t.classificacao}
                                   </span>
                                </div>
                                <p className="text-[11px] font-bold line-clamp-2 mb-2 leading-relaxed">
                                   {t.descricao || "Sem descrição registrada."}
                                </p>
                                {t.sintomas && t.sintomas.length > 0 && (
                                   <div className="flex flex-wrap gap-1">
                                      {t.sintomas.map((s: string, sIdx: number) => (
                                         <span key={sIdx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-[8px] font-bold opacity-60">
                                            {s}
                                         </span>
                                      ))}
                                   </div>
                                )}
                             </div>
                           ))}
                        </div>
                     </div>

                     <button className="w-full py-4 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-black/20 flex items-center justify-center gap-2">
                        Relatório Consolidado <FiExternalLink />
                     </button>
                   </motion.div>
                 )}
              </AnimatePresence>
           </section>

           <section className="p-8 rounded-[32px] bg-white dark:bg-[#0c0e14] border border-slate-200 dark:border-white/10 shadow-xl">
              <h3 className="text-sm font-black uppercase tracking-widest mb-6 opacity-40 flex items-center gap-2"><FiFilter /> Filtros Populacionais</h3>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase opacity-60">Doença Crônica</label>
                    <select value={filters.disease} onChange={(e) => setFilters(prev => ({ ...prev, disease: e.target.value }))} className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl py-3 px-4 text-xs font-bold outline-none cursor-pointer">
                       <option value="all">Todas as Condições</option>
                       <option value="Diabetes">Diabetes</option>
                       <option value="Hipertensão">Hipertensão</option>
                       <option value="Asma">Asma</option>
                       <option value="DPOC">DPOC</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase opacity-60">Risco</label>
                    <div className="grid grid-cols-2 gap-2">
                       {['all', 'Alto', 'Moderado', 'Baixo'].map(r => (
                          <button key={r} onClick={() => setFilters(prev => ({ ...prev, risk: r }))} className={`py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${filters.risk === r ? 'bg-[#0088ff] border-[#0088ff] text-white' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-500'}`}>{r === 'all' ? 'Todos' : r}</button>
                       ))}
                    </div>
                 </div>
              </div>
           </section>
        </aside>

        <div className="flex-1 h-full relative">
           <InssPopulationMap units={units} patients={patients} triages={triages} filters={filters} center={mapCenter} zoom={mapZoom} onRegionClick={(data) => { setSelectedRegion(data); setMapCenter([data.lat, data.lng]); setMapZoom(data.type === 'unit' ? 16 : 17); }} />

           {regionalStats && (
              <motion.div initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} className="absolute top-8 right-8 w-[320px] bg-white/95 dark:bg-[#0c0e14]/95 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-[40px] shadow-2xl z-[400] overflow-hidden">
                 <div className="p-8 border-b border-slate-200 dark:border-white/5">
                    <h3 className="text-lg font-black tracking-tight">{regionalStats.title}</h3>
                    <p className="text-[10px] font-black uppercase text-[#0088ff] tracking-widest mt-1">Análise Geográfica</p>
                 </div>
                 <div className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                          <p className="text-[9px] font-black uppercase opacity-40 mb-1">Pacientes</p>
                          <p className="text-xl font-black">{regionalStats.total}</p>
                       </div>
                       <div className="p-4 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                          <p className="text-[9px] font-black uppercase opacity-40 mb-1">Status</p>
                          <p className={`text-sm font-black uppercase ${regionalStats.risk === 'Crítico' ? 'text-red-500' : 'text-emerald-500'}`}>{regionalStats.risk}</p>
                       </div>
                    </div>
                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2"><FiActivity className="text-[#0088ff]" /><span className="text-[11px] font-bold">Predominância</span></div>
                          <span className="text-[11px] font-black uppercase">{regionalStats.predominant}</span>
                       </div>
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2"><FiDollarSign className="text-emerald-500" /><span className="text-[11px] font-bold">Custo</span></div>
                          <span className="text-[11px] font-black">R$ {(regionalStats.cost / 1000).toFixed(0)}K</span>
                       </div>
                    </div>
                    <button onClick={() => setSelectedRegion(null)} className="w-full py-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all">Limpar Foco</button>
                 </div>
              </motion.div>
           )}

           <div className="absolute bottom-10 left-10 p-4 rounded-2xl bg-white/50 dark:bg-black/40 backdrop-blur-md border border-white/10 z-[400] flex gap-6 items-center shadow-lg">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_red]" /><span className="text-[9px] font-black uppercase">Crítico</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_green]" /><span className="text-[9px] font-black uppercase">Estável</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-lg bg-[#0088ff] shadow-[0_0_10px_blue]" /><span className="text-[9px] font-black uppercase">Unidade</span></div>
           </div>
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px !important; display: block !important; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #0088ff; border-radius: 10px; border: 2px solid transparent; background-clip: content-box; }
        .leaflet-container { border-radius: 2rem !important; }
      `}</style>
    </div>
  );
}
