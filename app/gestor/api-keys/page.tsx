"use client";

import { useState, useEffect } from "react";
import { 
  FiKey, FiPlus, FiTrash2, FiClock, FiActivity, FiGlobe, 
  FiCopy, FiCheckCircle, FiExternalLink, FiTerminal, FiShield,
  FiFileText, FiRefreshCw, FiPower, FiChevronLeft, FiChevronDown
} from "react-icons/fi";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";

interface APIKey {
  id: number;
  nome: string;
  client_id: string;
  client_secret: string;
  status: number;
  data_cadastro: string;
}

interface APILog {
  id: number;
  client_id: string;
  integradora_nome: string;
  endpoint: string;
  metodo: string;
  ip_origem: string;
  status_code: number;
  req_count: number;
  data_cadastro: string;
}

export default function ApiKeysPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"keys" | "logs">("keys");
  const [logSubTab, setLogSubTab] = useState<"all" | "success" | "error">("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [logs, setLogs] = useState<APILog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    // Real-time polling every 5 seconds for logs
    let interval: any;
    if (activeTab === "logs") {
      interval = setInterval(() => fetchData(true), 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab]);

  const fetchData = async (isPoll = false) => {
    if (!isPoll) setLoading(true);
    try {
      const cacheBuster = `?t=${Date.now()}`;
      if (activeTab === "keys") {
        const res = await fetch("/api/gestor/api-keys" + cacheBuster, { cache: 'no-store' });
        const data = await res.json();
        setKeys(data);
      } else {
        const res = await fetch("/api/gestor/api-logs" + cacheBuster, { cache: 'no-store' });
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      if (!isPoll) toast.error("Erro ao carregar dados.");
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  const toggleGroup = (key: string) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  };

  // Log Filtering & Grouping
  const filteredLogs = logs.filter(log => {
     if (logSubTab === "success") return log.status_code < 400;
     if (logSubTab === "error") return log.status_code >= 400;
     return true;
  });

  const groupedLogs = filteredLogs.reduce((acc, log) => {
    const isUnauth = !log.integradora_nome || !log.client_id || log.client_id === "null" || log.client_id === "undefined";
    const groupKey = isUnauth ? `unauth-${log.ip_origem}` : `${log.client_id}-${log.ip_origem}`;
    
    if (!acc[groupKey]) {
      acc[groupKey] = {
        key: groupKey,
        name: isUnauth ? "Usuário não identificado" : log.integradora_nome,
        clientId: log.client_id,
        ip: log.ip_origem,
        totalReqs: 0,
        lastSeen: log.data_cadastro,
        items: [],
        processedPairs: new Set()
      };
    }
    
    // Sum unique req_counts from the DB per (client, ip) pair within this display group
    const pairId = `${log.client_id}-${log.ip_origem}`;
    if (!acc[groupKey].processedPairs.has(pairId)) {
        acc[groupKey].totalReqs += Number(log.req_count || 1);
        acc[groupKey].processedPairs.add(pairId);
    }

    if (new Date(log.data_cadastro) > new Date(acc[groupKey].lastSeen)) {
      acc[groupKey].lastSeen = log.data_cadastro;
    }
    
    acc[groupKey].items.push(log);
    return acc;
  }, {} as Record<string, any>);

  const sortedGroups = Object.values(groupedLogs).sort((a, b) => 
    new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  );

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      toast.success("Copiado para a área de transferência!");
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      toast.error("Erro ao copiar.");
    }
  };

  const toggleKeyStatus = async (id: number) => {
    try {
      const res = await fetch("/api/gestor/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success("Status alterado com sucesso!");
        fetchData(true);
      } else {
        toast.error("Erro ao alterar status.");
      }
    } catch (err) {
      toast.error("Erro de conexão.");
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("Informe um nome para a integradora.");
      return;
    }
    try {
      const res = await fetch("/api/gestor/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: newKeyName }),
      });
      if (res.ok) {
        toast.success("Chave gerada com sucesso!");
        setIsCreating(false);
        setNewKeyName("");
        fetchData(true);
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Erro ao criar chave.");
      }
    } catch (err) {
      toast.error("Erro de conexão.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#02040a] text-slate-900 dark:text-white font-sans pb-20">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/40 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
             <button 
              onClick={() => router.push('/')}
              className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 transition-all text-slate-500"
             >
                <FiChevronLeft size={20} />
             </button>
             <div>
                <h1 className="text-2xl font-black tracking-tight">
                   Gestão de API
                </h1>
                <p className="text-xs text-slate-400 font-mono uppercase tracking-widest mt-1">Controle de Acessos Externos</p>
             </div>
          </div>

          <div className="flex items-center gap-3">
             <button 
              onClick={() => router.push('/endpoints')}
              className="px-5 py-3 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-bold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/10 transition-all shadow-sm"
             >
                <FiFileText /> Ver Documentação
             </button>
             <button 
              onClick={() => setIsCreating(true)}
              className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
             >
                <FiPlus font-bold /> Nova Chave
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-10">
        
        {/* Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-1 p-1 bg-slate-200/50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 w-fit shadow-inner">
             <button 
              onClick={() => setActiveTab("keys")}
              className={`px-8 py-3 rounded-xl text-sm font-black transition-all ${activeTab === "keys" ? "bg-white dark:bg-white/10 text-blue-500 shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
             >
              Chaves Ativas
             </button>
             <button 
              onClick={() => setActiveTab("logs")}
              className={`px-8 py-3 rounded-xl text-sm font-black transition-all ${activeTab === "logs" ? "bg-white dark:bg-white/10 text-blue-500 shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
             >
              Logs de Uso
             </button>
          </div>

          {activeTab === "logs" && (
            <div className="flex items-center gap-1 p-1 bg-[#101218] rounded-xl border border-white/5">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'success', label: 'Sucesso' },
                  { id: 'error', label: 'Falhas' }
                ].map(st => (
                  <button 
                    key={st.id}
                    onClick={() => setLogSubTab(st.id as any)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${logSubTab === st.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}
                  >
                    {st.label}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {activeTab === "keys" ? (
            <motion.div 
              key="keys" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {keys.length === 0 && !loading && (
                <div className="lg:col-span-2 py-20 bg-white dark:bg-white/5 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/5 flex flex-col items-center justify-center text-slate-400">
                   <FiShield size={48} className="mb-4 opacity-20" />
                   <p className="font-bold">Nenhuma chave de API gerada ainda.</p>
                   <p className="text-xs">Comece criando uma chave para sua primeira integração.</p>
                </div>
              )}

              {keys.map(key => (
                <div key={key.id} className="p-8 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                   {/* Background Decor */}
                   <FiKey size={120} className="absolute -right-10 -bottom-10 opacity-[0.02] group-hover:rotate-12 transition-transform" />
                   
                   <div className="flex items-start justify-between mb-8">
                      <div>
                         <h3 className="text-xl font-bold">{key.nome}</h3>
                         <span className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${key.status === 1 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${key.status === 1 ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
                            {key.status === 1 ? 'Ativo' : 'Pausado'}
                         </span>
                      </div>
                      <button 
                        onClick={() => toggleKeyStatus(key.id)}
                        className={`p-3 rounded-2xl transition-all ${key.status === 1 ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}
                        title={key.status === 1 ? "Desativar" : "Ativar"}
                      >
                         <FiPower size={18} />
                      </button>
                   </div>

                   <div className="space-y-4">
                      <div className="group/field relative">
                         <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Client ID</label>
                         <div className="flex items-center gap-2 p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 font-mono text-xs">
                            <span className="truncate opacity-80">{key.client_id}</span>
                            <button onClick={() => copyToClipboard(key.client_id, `cid-${key.id}`)} className="ml-auto text-blue-500">
                               {copied === `cid-${key.id}` ? <FiCheckCircle /> : <FiCopy />}
                            </button>
                         </div>
                      </div>

                      <div className="group/field relative">
                         <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Client Secret</label>
                         <div className="flex items-center gap-2 p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 font-mono text-xs">
                            <span className="truncate opacity-40">●●●●●●●●●●●●●●●●●●●●</span>
                            <button onClick={() => copyToClipboard(key.client_secret, `cs-${key.id}`)} className="ml-auto text-blue-500 flex items-center gap-2">
                               <span className="text-[10px] font-bold">REVELAR E COPIAR</span>
                               {copied === `cs-${key.id}` ? <FiCheckCircle /> : <FiCopy />}
                            </button>
                         </div>
                      </div>
                   </div>

                   <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] text-slate-400 uppercase font-black">
                      <span className="flex items-center gap-1.5"><FiClock /> Criada em {new Date(key.data_cadastro).toLocaleDateString('pt-BR')}</span>
                      <span className="flex items-center gap-1.5 text-blue-500 hover:underline cursor-pointer" onClick={() => setActiveTab("logs")}><FiActivity /> Ver Atividade</span>
                   </div>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="logs" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-white/10 shadow-xl overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Origem / Integradora</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Volume Total</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Último Acesso</th>
                      <th className="px-6 py-5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {sortedGroups.map((group: any) => (
                      <React.Fragment key={group.key}>
                        <tr 
                          onClick={() => toggleGroup(group.key)}
                          className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-6">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                                  <FiGlobe />
                               </div>
                               <div className="flex flex-col">
                                  <span className="font-bold text-sm text-[#0088ff]">{group.name}</span>
                                  <span className="text-[10px] font-mono opacity-50 uppercase tracking-widest">{group.ip}</span>
                               </div>
                            </div>
                          </td>
                          <td className="px-6 py-6 text-center">
                             <div className="inline-flex flex-col items-center">
                                <span className="text-xl font-black text-slate-800 dark:text-white">{group.totalReqs}</span>
                                <span className="text-[8px] font-black uppercase opacity-30">REQUISIÇÕES</span>
                             </div>
                          </td>
                          <td className="px-6 py-6 text-right">
                             <div className="flex flex-col items-end">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{new Date(group.lastSeen).toLocaleDateString('pt-BR')}</span>
                                <span className="text-[9px] opacity-40 font-mono italic">{new Date(group.lastSeen).toLocaleTimeString('pt-BR')}</span>
                             </div>
                          </td>
                          <td className="px-6 py-6">
                             <div className={`p-2 rounded-lg transition-transform ${expandedGroups.has(group.key) ? 'rotate-180 bg-blue-500 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}>
                                <FiChevronDown />
                             </div>
                          </td>
                        </tr>
                        
                        <AnimatePresence>
                          {expandedGroups.has(group.key) && (
                            <tr>
                              <td colSpan={4} className="p-0 border-b border-white/5 bg-slate-50/50 dark:bg-black/40">
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-10 py-6 space-y-3">
                                     <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 mb-4 ml-2">Histórico Cronológico do Cliente</p>
                                     {group.items.map((item: any) => (
                                       <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-blue-500/30 transition-all">
                                          <div className="flex items-center gap-4">
                                             <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-black/50 text-[9px] font-black text-slate-500 uppercase">{item.metodo}</span>
                                             <span className="text-xs font-mono opacity-80">{item.endpoint}</span>
                                          </div>
                                          <div className="flex items-center gap-6">
                                             <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${item.status_code >= 400 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                               {item.status_code}
                                             </span>
                                             <span className="text-[10px] font-mono opacity-30">{new Date(item.data_cadastro).toLocaleTimeString('pt-BR')}</span>
                                          </div>
                                       </div>
                                     ))}
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    ))}
                    {sortedGroups.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-20 text-center text-slate-400 italic text-sm">
                          Nenhum log corresponde aos filtros ativos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modal Nova Chave */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-black/60">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-2xl border border-white/10"
            >
               <h3 className="text-2xl font-black mb-2">Nova Integração</h3>
               <p className="text-sm text-slate-500 mb-8">Defina um nome para identificar a integradora que utilizará estas credenciais.</p>
               
               <div className="space-y-6">
                 <div>
                   <label className="text-xs font-black uppercase tracking-widest opacity-40 mb-2 block">Nome da Integradora</label>
                   <input 
                    type="text" 
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Ex: SaudeGov Federal / Portal Cidadão"
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
                   />
                 </div>

                 <div className="flex items-center gap-3 pt-4">
                    <button 
                      onClick={() => setIsCreating(false)}
                      className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-all font-sans"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleCreateKey}
                      className="flex-1 px-6 py-4 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all"
                    >
                      Gerar Agora
                    </button>
                 </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
