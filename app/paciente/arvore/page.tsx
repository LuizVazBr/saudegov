"use client";
import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search, User, ShieldAlert, Loader2, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PatientTreeView from "@/components/PatientTreeView";
import { toast } from "sonner";

export default function PatientTreePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);
  const [recentSearches, setRecentSearches] = useState<{name: string, cpf: string}[]>([]);

  const maskCpf = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(maskCpf(e.target.value));
  };

  useEffect(() => {
    const saved = localStorage.getItem("anamnex:recent_patients");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar recentes:", e);
      }
    }

    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      const role = session?.user?.tipo_usuario?.toLowerCase();
      if (!["medico", "enfermeiro", "gestor"].includes(role || "")) {
        router.push("/dashboard");
        toast.error("Acesso restrito a profissionais de saúde.");
      }
    }
  }, [status, session, router]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length < 11) {
      toast.error("Por favor, insira um CPF válido.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/paciente/arvore-completa?cpf=${cleanCpf}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao buscar paciente.");
      }

      setPatientData(data);
      toast.success("Paciente encontrado com sucesso!");

      // Salvar nos recentes
      const currentPatient = { name: data.patient.nome, cpf: cleanCpf };
      setRecentSearches(prev => {
        const filtered = prev.filter(p => p.cpf !== cleanCpf);
        const updated = [currentPatient, ...filtered].slice(0, 3);
        localStorage.setItem("anamnex:recent_patients", JSON.stringify(updated));
        return updated;
      });
    } catch (error: any) {
      toast.error(error.message);
      setPatientData(null);
    } finally {
      setLoading(false);
    }
  };



  return (
    <main className="min-h-screen bg-[#020617] text-white selection:bg-emerald-500/30">
      <AnimatePresence mode="wait">
        {!patientData ? (
          <motion.div 
            key="search"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center min-h-screen p-6"
          >
            <div className="w-full max-w-md space-y-8 relative">
              <button 
                onClick={() => router.back()}
                className="absolute -top-12 left-0 p-3 bg-white/5 border border-white/5 rounded-2xl text-white/20 hover:text-white hover:bg-white/10 transition-all"
                title="Voltar"
              >
                <ArrowLeft size={20}/>
              </button>

              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
                  <User className="text-emerald-500" size={40} />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Explorador clínico</h1>
                <p className="text-white/40 text-sm">Insira o CPF do paciente para visualizar sua árvore de histórico completo.</p>
              </div>

              <form onSubmit={handleSearch} className="space-y-4">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="text-white/20 group-focus-within:text-emerald-500 transition-colors" size={20} />
                  </div>
                  <input
                    type="text"
                    value={cpf}
                    onChange={handleCpfChange}
                    placeholder="000.000.000-00"
                    disabled={loading}
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-xl font-mono tracking-widest placeholder:text-white/10"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      <Search size={20} />
                      LOCALIZAR PACIENTE
                    </>
                  )}
                </button>
              </form>

              {/* RECENTES */}
              <AnimatePresence>
                {recentSearches.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-4 pt-4"
                  >
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Recentes</span>
                       <div className="flex-1 h-[1px] bg-white/5" />
                    </div>
                    <div className="grid gap-3">
                      {recentSearches.map((p, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setCpf(maskCpf(p.cpf));
                            // Trigger search slightly after mask
                            setTimeout(() => {
                                const form = document.querySelector('form');
                                form?.requestSubmit();
                            }, 50);
                          }}
                          className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all text-left group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-white/40 group-hover:text-emerald-500 transition-colors">
                               <User size={18} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white uppercase">{p.name}</p>
                              <p className="text-[10px] font-mono text-white/30">{maskCpf(p.cpf)}</p>
                            </div>
                          </div>
                          <Search size={14} className="text-white/10 group-hover:text-emerald-500 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="tree"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen"
          >
            <PatientTreeView 
              data={patientData} 
              onClose={() => setPatientData(null)} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        body {
          background-color: #020617;
          overflow: hidden;
        }
      `}</style>
    </main>
  );
}
