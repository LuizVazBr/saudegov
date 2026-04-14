"use client";

import { useState, useEffect, useRef } from "react";
import { 
  FiGlobe, FiMapPin, FiTerminal, FiExternalLink, FiCopy, FiCheckCircle, FiInfo, 
  FiChevronLeft, FiLock, FiShield, FiPlay, FiCpu, FiCode, FiZap 
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";

export default function EndpointsPage() {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);

  // States para o Playground
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [token, setToken] = useState("");
  const [executing, setExecuting] = useState(false);
  const [testResponse, setTestResponse] = useState<any>(null);
  
  // States para parâmetros de teste
  const [lat, setLat] = useState("-15.7783");
  const [lng, setLng] = useState("-47.9319");
  const [clienteFiltro, setClienteFiltro] = useState("Isac_TO");
  const [modoTeste, setModoTeste] = useState(false);

  // ScrollSpy logic
  const [activeSection, setActiveSection] = useState("security");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.5, rootMargin: "-10% 0% -40% 0%" }
    );

    const sections = ["security", "auth-token", "lista-unidades", "proximidade", "playground"];
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copiado!");
  };

  const handleGetToken = async () => {
    if (!clientId || !clientSecret) {
      toast.error("Informe Client ID e Secret");
      return;
    }
    setExecuting(true);
    try {
      const res = await fetch("/api/saudegov/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.access_token);
        setTestResponse({ status: res.status, body: data });
        toast.success("Token gerado!");
      } else {
        setToken(""); // Limpa o token anterior em caso de erro
        setTestResponse({ status: res.status, body: data });
        toast.error("Erro na autenticação");
      }
    } catch (err) {
      toast.error("Erro na conexão");
    } finally {
      setExecuting(false);
    }
  };

  const handleTestEndpoint = async (path: string) => {
    if (!token) {
      toast.error("Gere um token primeiro");
      return;
    }
    setExecuting(true);
    try {
      let finalUrl = path;
      const separator = path.includes("?") ? "&" : "?";
      
      if (path.includes("proxima")) {
        finalUrl += `?lat=${lat}&lng=${lng}`;
      } else if (path.includes("unidades")) {
        finalUrl += `?cliente=${clienteFiltro}`;
      }

      // Adiciona flag de teste se ativo
      if (modoTeste) {
        const testSep = finalUrl.includes("?") ? "&" : "?";
        finalUrl += `${testSep}teste=true`;
      }

      const res = await fetch(finalUrl, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setTestResponse({ status: res.status, body: data });
      if (res.ok) toast.success("Requisição concluída!");
      else toast.error(`Erro ${res.status}`);
    } catch (err) {
      toast.error("Erro na requisição");
    } finally {
      setExecuting(false);
    }
  };

  const copyFullDocumentation = () => {
    let text = "*Documentação API SaudeGov (Anamnex)*\n\n";
    text += "A API SaudeGov permite integrar as informações de rede de atendimento da Anamnex em sistemas governamentais ou portais do cidadão, facilitando o acesso.\n\n";
    
    text += "*🔐 SEGURANÇA OAUTH 2.0*\n";
    text += "Requer Bearer Token no header HTTP de todas as chamadas. Obtenha o token enviando Client ID e Secret para o endpoint de autenticação.\n\n";

    endpoints.forEach(ep => {
      text += `--- *${ep.title.toUpperCase()}* ---\n`;
      text += `• Método: ${ep.method}\n`;
      text += `• Rota: ${ep.path}\n`;
      text += "• Parâmetros:\n";
      ep.params.forEach(p => {
        text += `   - ${p.name}: ${p.description}\n`;
      });
      text += `\nExemplo de Resposta:\n${ep.response}\n\n`;
    });

    text += "© 2026 Cliv. Todos os direitos reservados.";

    navigator.clipboard.writeText(text);
    toast.success("Documentação completa copiada!");
  };

  const endpoints = [
    {
      id: "auth-token",
      title: "Autenticação (OAuth 2.0)",
      description: "Gera um Token de acesso Bearer utilizando suas credenciais de API.",
      method: "POST",
      path: "/api/saudegov/token",
      params: [
        { name: "client_id", type: "string", required: true, description: "Identificador da aplicação cliente." },
        { name: "client_secret", type: "string", required: true, description: "Chave secreta de autenticação." },
      ],
      response: `{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "scope": "saudegov.read"
}`
    },
    {
      id: "lista-unidades",
      title: "Consultar lista de unidades de saúde",
      description: "Retorna a lista completa de unidades de saúde cadastradas no portal Anamnex.",
      method: "GET",
      path: "/api/saudegov/unidades",
      params: [
        { name: "Authorization", type: "string (Header)", required: true, description: "Bearer [access_token]" },
        { name: "cliente", type: "string", description: "Filtro por identificador (Ex: Isac_TO)." },
      ],
      response: `[
  {
    "id": 1,
    "nome": "UBS Araguaína Sul",
    "tipo": "UBS",
    "endereco": "Rua das Palmeiras - Lot. Araguaina Sul...",
    "localizacao": { "lat": -7.2185, "lng": -48.2144 }
  }
]`
    },
    {
      id: "proximidade",
      title: "Unidade de saúde mais próxima",
      description: "Localiza a unidade mais próxima das coordenadas informadas.",
      method: "GET",
      path: "/api/saudegov/proxima",
      params: [
        { name: "Authorization", type: "string (Header)", required: true, description: "Bearer [access_token]" },
        { name: "lat", type: "number", required: true, description: "Latitude da localização atual." },
        { name: "lng", type: "number", required: true, description: "Longitude da localização atual." },
      ],
      response: `{
  "success": true,
  "data": {
    "nome": "UPA Araguaína",
    "tipo": "UPA",
    "endereco": "R. dos Pinheiros, 1018 - St - Lot. Araguaina Sul...",
    "distancia_aproximada_km": 1.45,
    "localizacao": { "lat": -7.2132, "lng": -48.2167 }
  }
}`
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#02040a] text-slate-900 dark:text-white font-sans selection:bg-blue-500/30 pb-20">
      <Toaster position="top-right" />
      
      {/* Header Premium */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/40 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                try { router.push('/saudegov'); } catch (e) { window.location.href = '/saudegov'; }
              }}
              className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-slate-500 group"
            >
              <FiChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
            </button>
            <div>
               <h1 className="text-xl font-bold tracking-tight">Endpoints SaudeGov</h1>
               <p className="text-[10px] uppercase tracking-[0.2em] opacity-40 font-black">Documentação da API</p>
            </div>
          </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={copyFullDocumentation}
                title="Copiar documentação completa"
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-all text-blue-500 flex items-center gap-2 group"
              >
                <FiCopy size={16} className="group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-tighter hidden sm:inline">Compartilhar</span>
              </button>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                API ONLINE
              </div>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Sidebar */}
          <aside className="lg:col-span-3 hidden lg:block">
            <nav className="sticky top-28 space-y-1">
              <a 
                href="#security" 
                className={`flex items-center gap-2 px-4 py-3 mb-4 rounded-xl text-sm font-bold border transition-all shadow-inner ${activeSection === 'security' ? 'bg-blue-500 text-white border-blue-600' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}
              >
                <FiLock size={14} /> Segurança OAuth 2.0
              </a>
              {endpoints.map(ep => (
                <a 
                  key={ep.id} 
                  href={`#${ep.id}`} 
                  className={`block px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeSection === ep.id ? 'bg-slate-200 dark:bg-white/10 text-blue-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-blue-500'}`}
                >
                  {ep.title}
                </a>
              ))}
              <a 
                href="#playground" 
                className={`flex items-center gap-2 px-4 py-3 mt-8 rounded-xl text-sm font-bold border transition-all shadow-inner ${activeSection === 'playground' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}
              >
                <FiZap size={14} /> Playground de Testes
              </a>
            </nav>
          </aside>

          {/* Content */}
          <div className="lg:col-span-9 space-y-16">
            
            <section>
              <h2 className="text-3xl font-black tracking-tight mb-4 uppercase">Primeiros passos</h2>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl bg-white/5 p-4 rounded-2xl border border-white/5">
                A API SaudeGov permite integrar as informações de rede de atendimento da Anamnex em sistemas governamentais ou portais do cidadão, facilitando o acesso.
              </p>
            </section>

            {/* Segurança */}
            <section id="security" className="scroll-mt-28">
              <div className="p-8 rounded-3xl bg-blue-600/5 border border-blue-500/20 relative overflow-hidden">
                <FiLock className="absolute -right-4 -bottom-4 text-blue-500/10" size={120} />
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                    <FiShield size={24} />
                  </div>
                  <h3 className="text-2xl font-bold">Segurança OAuth 2.0</h3>
                </div>
                <div className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed text-slate-500 dark:text-slate-400 space-y-4">
                  <p>Para garantir a proteção dos dados governamentais, todas as requisições devem conter um Bearer Token válido no header HTTP.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5">
                      <p className="font-bold text-slate-800 dark:text-slate-200 mb-2">1. Obtenção do Token</p>
                      <p>Envie suas credenciais (Client ID / Secret) para o endpoint de token para receber um access_token válido por 24 horas.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5">
                      <p className="font-bold text-slate-800 dark:text-slate-200 mb-2">2. Uso do Token</p>
                      <p>Inclua o token em todas as chamadas de dados: <code>Authorization: Bearer seu_token_aqui</code>.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Endpoints */}
            <div className="space-y-12">
              {endpoints.map((ep, idx) => (
                <motion.section 
                  key={ep.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  id={ep.id} 
                  className="scroll-mt-28"
                >
                  <div className="flex flex-col gap-6 p-8 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <h3 className="text-xl font-bold">{ep.title}</h3>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm animate-pulse">API ONLINE</span>
                        <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">JSON</span>
                      </div>
                      <code className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-black/50 border border-slate-200 dark:border-white/5 text-[11px] font-mono opacity-80">{ep.path}</code>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{ep.description}</p>
                    <pre className="p-6 rounded-2xl bg-slate-900 text-blue-400 font-mono text-xs overflow-x-auto border border-white/5 leading-relaxed">
                      {ep.response}
                    </pre>
                  </div>
                </motion.section>
              ))}
            </div>

            {/* PLAYGROUND */}
            <section id="playground" className="scroll-mt-28">
              <div className="p-8 rounded-[40px] bg-slate-900 border border-emerald-500/20 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                   <FiTerminal size={100} className="text-emerald-500" />
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                      <FiPlay size={20} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white">Sandbox de Testes</h3>
                      <p className="text-xs text-emerald-500 uppercase font-black tracking-widest mt-1">Ambiente de Execução Real</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-white/5 p-2 pr-4 rounded-2xl border border-white/10">
                    <div 
                      onClick={() => setModoTeste(!modoTeste)}
                      className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-all duration-300 ${modoTeste ? 'bg-amber-500' : 'bg-gray-700'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${modoTeste ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap">
                      {modoTeste ? 'Modo Teste Ativo' : 'Modo Produção'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Inputs */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">1. Autenticação</h4>
                       <div className="grid grid-cols-1 gap-3">
                          <input 
                            type="text" placeholder="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-white outline-none focus:border-emerald-500/50 transition-all placeholder:text-gray-600"
                          />
                          <input 
                            type="password" placeholder="Client Secret" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-white outline-none focus:border-emerald-500/50 transition-all placeholder:text-gray-600"
                          />
                          <button 
                            onClick={handleGetToken} disabled={executing}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition-all uppercase tracking-widest"
                          >
                            {executing ? "PROCESSANDO..." : "OBTER ACCESS_TOKEN"}
                          </button>
                       </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/5">
                       <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">2. Executar Chamada</h4>
                          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase transition-all ${token ? 'bg-emerald-500 text-black' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                             {token ? <><FiCheckCircle /> Token Ativo</> : 'Aguardando Token'}
                          </div>
                       </div>
                       
                       <div className={`space-y-4 transition-all ${!token ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
                          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-3 hover:border-emerald-500/30 transition-all">
                             <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-white uppercase opacity-40">Proximidade (GPS)</span>
                                <button onClick={() => handleTestEndpoint('/api/saudegov/proxima')} disabled={!token || executing} className="text-[10px] font-black text-emerald-500 hover:text-white transition-colors">TESTAR AGORA</button>
                             </div>
                             <div className="flex gap-2">
                                <input type="text" placeholder="Lat" value={lat} onChange={(e) => setLat(e.target.value)} className="w-1/2 bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[10px] font-mono text-white outline-none focus:border-emerald-500/50" />
                                <input type="text" placeholder="Lng" value={lng} onChange={(e) => setLng(e.target.value)} className="w-1/2 bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[10px] font-mono text-white outline-none focus:border-emerald-500/50" />
                             </div>
                          </div>

                          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-3 hover:border-emerald-500/30 transition-all">
                             <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-white uppercase opacity-40">Lista de Unidades</span>
                                <button onClick={() => handleTestEndpoint('/api/saudegov/unidades')} disabled={!token || executing} className="text-[10px] font-black text-emerald-500 hover:text-white transition-colors">TESTAR AGORA</button>
                             </div>
                             <input type="text" placeholder="Identificador do Cliente" value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[10px] font-mono text-white outline-none focus:border-emerald-500/50" />
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* Console */}
                  <div className="flex flex-col h-full min-h-[400px]">
                      <div className="flex items-center justify-between px-4 py-2 bg-black/60 rounded-t-xl border-t border-x border-white/10">
                         <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-tighter text-emerald-500/60 font-black">
                            <FiTerminal /> Response Console
                         </div>
                         <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500/20" />
                            <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
                            <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
                         </div>
                      </div>
                      <div className="flex-1 bg-black/80 rounded-b-xl border-b border-x border-white/10 p-4 font-mono text-[10px] overflow-auto max-h-[400px]">
                         {testResponse ? (
                           <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                 <span className="text-gray-500">Status:</span> 
                                 <span className={testResponse.status === 200 ? "text-emerald-500" : "text-red-500"}>{testResponse.status}</span>
                              </div>
                              <div className="text-blue-400">
                                 {JSON.stringify(testResponse.body, null, 2)}
                              </div>
                           </div>
                         ) : (
                           <div className="h-full flex flex-col items-center justify-center opacity-20 text-white gap-2">
                              <FiCode size={32} />
                              <p className="font-bold">Aguardando execução...</p>
                           </div>
                         )}
                      </div>
                  </div>
                </div>

              </div>
            </section>

          </div>
        </div>
      </main>

      <footer className="mt-24 border-t border-slate-200 dark:border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 opacity-40 grayscale uppercase">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500" />
              <span className="font-bold tracking-tighter font-mono">Anamnex API</span>
           </div>
           <p className="text-xs font-mono">@ 2026 Cliv. Todos os direitos reservados.</p>
        </div>
      </footer>

    </div>
  );
}
