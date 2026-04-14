"use client";

import { motion } from "framer-motion";
import { 
  FiChevronLeft, FiUser, FiShield, FiClock, FiCpu, 
  FiSearch, FiArrowRight, FiExternalLink, FiGlobe, FiInfo 
} from "react-icons/fi";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";

export default function SaudeGovPortal() {
  const router = useRouter();

  const services = [
    {
      id: "cidadao",
      title: "Cidadão",
      description: "Histórico clínico unificado, agendamentos e carteira digital de saúde.",
      icon: FiUser,
      color: "bg-blue-600",
      link: "/cidadao"
    },
    {
      id: "tcu",
      title: "TCU",
      description: "Portal de transparência, auditoria de recursos e métricas de desempenho municipal.",
      icon: FiShield,
      color: "bg-slate-800",
      link: "/gestor/dashboard"
    },
    {
      id: "inss",
      title: "INSS",
      description: "Integração para perícia médica, benefícios previdenciários e auxílio-doença.",
      icon: FiClock,
      color: "bg-emerald-600",
      link: "/saudegov/inss"
    },
    {
      id: "api",
      title: "API",
      description: "Gerenciamento de integrações, chaves de API e documentação técnica de endpoints municipais.",
      icon: FiCpu,
      color: "bg-indigo-600",
      link: "/endpoints/"
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#02040a] text-slate-900 dark:text-white font-sans">
      <Toaster position="top-right" />
      {/* Gov.br Top Bar */}
      <div className="bg-[#004b82] text-white px-6 py-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><FiGlobe /> Brasil</span>
          <span className="opacity-60">Portal de Serviços</span>
        </div>
        <div className="flex items-center gap-4">
           <span className="hover:underline cursor-pointer">Acesso à Informação</span>
           <span className="hover:underline cursor-pointer">Legislação</span>
           <span className="hover:underline cursor-pointer">Canais</span>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white dark:bg-[#0c0e14] border-b border-slate-200 dark:border-white/5 px-6 py-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => router.push('/gestor/dashboard')}
              className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 transition-all text-slate-500"
            >
              <FiChevronLeft size={20} />
            </button>
            <div className="flex flex-col">
              <h1 className="text-2xl font-black text-[#004b82] dark:text-white flex items-center gap-2">
                <span className="font-light italic opacity-60">Meu</span>SaudeGov
              </h1>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">A Nova Inteligência da Gestão em Saúde Digital</span>
            </div>
          </div>
          
          <div className="hidden md:flex flex-1 max-w-md mx-12">
            <div className="relative w-full">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar serviço ou informação..."
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#004b82] transition-all"
              />
            </div>
          </div>

          <button 
            onClick={() => toast.success("Autenticação gov.br iniciada. Redirecionando para o ambiente seguro...")}
            className="px-6 py-3 rounded-2xl bg-[#004b82] text-white text-sm font-bold shadow-lg shadow-blue-900/20 hover:bg-[#003366] transition-all flex items-center gap-2"
          >
             Entrar com <span className="font-black italic">gov.br</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16"
        >
          <h2 className="text-4xl font-black tracking-tight text-[#004b82] dark:text-white mb-4">
            Portal de Gestão Integrada
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
            Acesse as principais ferramentas de monitoramento governamental e serviços de saúde integrados à rede Anamnex.
          </p>
        </motion.div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, idx) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -5 }}
              className="p-8 rounded-[32px] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
            >
              <div className={`w-14 h-14 ${service.color} rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-blue-500/10`}>
                <service.icon size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">{service.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-8">
                {service.description}
              </p>
              
              <button 
                onClick={() => router.push(service.link)}
                className="flex items-center gap-2 text-sm font-black text-[#004b82] dark:text-blue-400 group-hover:gap-4 transition-all uppercase tracking-widest"
              >
                Acessar Área <FiArrowRight />
              </button>

              <div className="absolute -right-4 -bottom-4 opacity-5 text-slate-900 dark:text-white group-hover:scale-110 transition-transform">
                <service.icon size={120} />
              </div>
            </motion.div>
          ))}
        </div>

      </main>
    </div>
  );
}
