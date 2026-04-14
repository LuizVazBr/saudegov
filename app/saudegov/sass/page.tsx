"use client";

import { motion } from "framer-motion";
import { 
  FiChevronLeft, FiHeart, FiUsers, FiMapPin, FiActivity, FiAlertTriangle,
  FiArrowRight, FiCheckCircle, FiTrendingUp, FiShare2, FiGrid
} from "react-icons/fi";
import { useRouter } from "next/navigation";

export default function SASSHub() {
  const router = useRouter();

  const stats = [
    { label: "Famílias Assistidas", value: "1,240", icon: FiUsers, color: "text-blue-500" },
    { label: "Áreas de Risco Soc.", value: "14", icon: FiMapPin, color: "text-rose-500" },
    { label: "Visitas Agendadas", value: "85", icon: FiActivity, color: "text-emerald-500" },
    { label: "Protocolos SASS", value: "Active", icon: FiCheckCircle, color: "text-[#0088ff]" },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#02040a] text-slate-900 dark:text-white font-sans">
      
      {/* Header */}
      <header className="bg-white dark:bg-[#0c0e14] border-b border-slate-200 dark:border-white/5 px-8 py-6 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => router.push('/saudegov')}
              className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-rose-500 hover:text-white transition-all text-slate-500"
            >
              <FiChevronLeft size={20} />
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-black flex items-center gap-2">
                <FiHeart className="text-rose-500" /> Monitoramento Social (SASS)
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de Equidade e Assistência Integrada</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button className="px-5 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                <FiGrid /> Layout Grade
             </button>
             <button className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition-all">
                Novo Protocolo
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
           {stats.map((s, idx) => (
              <motion.div 
                 key={s.label}
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: idx * 0.1 }}
                 className="p-8 rounded-[32px] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm"
              >
                 <div className={`w-12 h-12 rounded-2xl bg-slate-100 dark:bg-black/20 flex items-center justify-center mb-6 ${s.color}`}>
                    <s.icon size={24} />
                 </div>
                 <p className="text-[10px] font-black uppercase opacity-40 mb-1">{s.label}</p>
                 <p className="text-2xl font-black">{s.value}</p>
              </motion.div>
           ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Main Activity */}
           <div className="lg:col-span-2 space-y-8">
              <section className="p-8 rounded-[40px] bg-white dark:bg-[#101218] border border-slate-200 dark:border-white/5 shadow-xl">
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                       <FiActivity className="text-emerald-500" /> Áreas de Atenção Prioritária
                    </h3>
                    <button className="text-[10px] font-black text-[#0088ff] uppercase tracking-widest hover:underline">Ver Mapa Completo</button>
                 </div>
                 
                 <div className="space-y-4">
                    {[
                       { area: "Setor Sul - Vila Nova", risco: "Alto", triagens: 42, tendencia: "subindo" },
                       { area: "Distrito Industrial III", risco: "Crítico", triagens: 18, tendencia: "estável" },
                       { area: "Residencial Esperança", risco: "Médio", triagens: 29, tendencia: "descendo" },
                    ].map((row, idx) => (
                       <div key={row.area} className="flex items-center justify-between p-6 rounded-2xl bg-slate-100/50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-rose-500/30 transition-all cursor-pointer group">
                          <div className="flex items-center gap-4">
                             <div className={`p-2 rounded-lg ${row.risco === 'Crítico' ? 'bg-rose-500/10 text-rose-500' : row.risco === 'Alto' ? 'bg-orange-500/10 text-orange-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                <FiAlertTriangle size={18} />
                             </div>
                             <div>
                                <p className="font-bold text-sm tracking-tight">{row.area}</p>
                                <p className="text-[10px] uppercase font-black opacity-30">Zoneamento Social {idx + 1}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-8">
                             <div className="text-right">
                                <p className="text-xs font-bold">{row.triagens} Casos</p>
                                <p className="text-[9px] uppercase font-black text-emerald-500">+{idx * 2}% Eficácia</p>
                             </div>
                             <FiArrowRight className="text-slate-300 group-hover:text-rose-500 transition-colors" />
                          </div>
                       </div>
                    ))}
                 </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="p-8 rounded-[32px] bg-gradient-to-br from-rose-600 to-rose-800 text-white shadow-xl relative overflow-hidden group">
                    <FiHeart size={120} className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-110 transition-transform" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-60">Urgência Assistencial</h4>
                    <p className="text-2xl font-black mb-2">08 Famílias</p>
                    <p className="text-xs opacity-60 leading-relaxed mb-8">Aguardando visita técnica prioritária por risco de desnutrição ou falta de saneamento.</p>
                    <button className="px-6 py-3 rounded-xl bg-white text-rose-600 text-[10px] font-black uppercase tracking-widest shadow-lg">Despachar Equipe</button>
                 </div>

                 <div className="p-8 rounded-[32px] bg-white dark:bg-[#101218] border border-slate-200 dark:border-white/5 shadow-xl">
                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-6 opacity-40">Resolutividade</h4>
                    <div className="flex items-end gap-2 mb-4">
                       <span className="text-4xl font-black">92%</span>
                       <FiTrendingUp className="text-emerald-500 mb-2" size={24} />
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 w-[92%]" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-6 text-[#0088ff] cursor-pointer hover:underline">Ver Relatório Anual</p>
                 </div>
              </div>
           </div>

           {/* Sidebar Tools */}
           <div className="space-y-8">
              <section className="p-8 rounded-[40px] bg-slate-900 text-white shadow-2xl h-fit">
                 <h3 className="text-sm font-black uppercase tracking-widest mb-8 flex items-center gap-3">
                    <FiShare2 className="text-blue-400" /> Encaminhamentos
                 </h3>
                 <div className="space-y-6">
                    {[
                       { label: "Cesta Básica Digital", count: 312, status: "Aprovado" },
                       { label: "Auxílio Gás Municipal", count: 189, status: "Aguardando" },
                       { label: "Isenção IPTU Social", count: 45, status: "Revisão" },
                    ].map((item) => (
                       <div key={item.label} className="pb-6 border-b border-white/5 last:border-0">
                          <div className="flex items-center justify-between mb-2">
                             <p className="text-sm font-bold tracking-tight">{item.label}</p>
                             <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-white/10">{item.status}</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-[70%]" />
                             </div>
                             <span className="text-[10px] font-black opacity-40">{item.count}</span>
                          </div>
                       </div>
                    ))}
                 </div>
                 <button className="w-full mt-10 py-5 rounded-2xl bg-[#0088ff] text-white font-black text-sm uppercase tracking-widest transition-transform hover:scale-[1.02]">
                    Novo Encaminhamento
                 </button>
              </section>

              <div className="p-8 rounded-[32px] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                 <h4 className="text-[10px] font-black uppercase tracking-widest mb-6 opacity-40 italic">Suporte Técnico</h4>
                 <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Dúvidas sobre o fechamento de protocolos assistenciais? Acesse a base de conhecimento SASS.
                 </p>
                 <button className="mt-6 text-[10px] font-black uppercase tracking-widest text-[#0088ff] flex items-center gap-2">
                    Manuais de Operação <FiArrowRight />
                 </button>
              </div>
           </div>
        </div>
      </main>

    </div>
  );
}
