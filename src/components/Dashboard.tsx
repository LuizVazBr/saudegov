"use client";

import { useState, useEffect } from "react";
import { FiEye, FiEdit2, FiTrash2, FiSearch, FiPlus, FiAlertCircle, FiX, FiSettings } from "react-icons/fi";
import BottomSheetModal from "./BottomSheetModal";
import HeaderIn from "@/components/HeaderIn";
import { useTheme } from "@/components/ThemeProvider";
import { toast, Toaster } from "react-hot-toast";
import { Session } from "next-auth";
import UserFormModal from "./UserFormModal";
import ManagementTable from "./ManagementTable";
import DigitalSignatureModal from "./DigitalSignatureModal";
import UnitFormModal from "./UnitFormModal";
import { FiEdit3, FiCheckCircle, FiMap, FiHome } from "react-icons/fi";
import { getDeviceInfo } from "@/lib/deviceDetection";
import Loader from "./Loader";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Relato {
  id: string;
  nome: string;
  data: string;
  descricao: string;
  status: string;
  sintomas: string[];
  classificacao: string;
  checkinDataHora?: string;
  pacienteNome?: string;
  pacienteSexo?: string;
  pacienteIdade?: number;
  pacienteSUS?: string;
  historicoAtualizacao?: any;
  statusCheckin?: string;
  dataCadastro?: string;
  tempoTranscricao?: number; // segundos
}

interface DashboardProps {
  enfermeiroId: string;
  enfermeiroNome: string;
  sessionServer?: Session;
}

export default function Dashboard({
  enfermeiroId,
  enfermeiroNome,
  sessionServer,
}: DashboardProps) {
  const { tema, themeName } = useTheme();
  const [historico, setHistorico] = useState<Relato[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
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

  const toggleModoTeste = (ativoValue: boolean) => {
    setModoTeste(ativoValue);
    localStorage.setItem("cliv_modo_teste", ativoValue ? "true" : "false");
    toast.success(`Modo Teste ${ativoValue ? 'ATIVADO' : 'DESATIVADO'}`);
    // O useEffect [modoTeste] cuidará de re-puxar o histórico
  };

  const [abaAtiva, setAbaAtiva] = useState<"listas" | "relatorios" | "configuracoes">(
    "listas"
  );

  const [abaLista, setAbaLista] = useState<
    "fila" | "pacientes" | "medicos" | "enfermeiros" | "gestores" | "unidades"
  >("fila");

  // Estados de Paginação e Busca para Fila
  const [pageFila, setPageFila] = useState(1);
  const [hasMoreFila, setHasMoreFila] = useState(true);
  const [searchFila, setSearchFila] = useState("");
  const [subAbaClassificacao, setSubAbaClassificacao] = useState("todas");
  const [subAbaStatus, setSubAbaStatus] = useState("todas");
  const [historicoRelatorio, setHistoricoRelatorio] = useState<Relato[]>([]);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);
  const [relatoParaModal, setRelatoParaModal] = useState<Relato | null>(null);
  const [modalDetalheAberto, setModalDetalheAberto] = useState(false);

  // Estados de Paginação para Admin
  const [pageAdmin, setPageAdmin] = useState(1);
  const [hasMoreAdmin, setHasMoreAdmin] = useState(true);

  // Estados Assinatura Digital
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [selectedDoctorForSignature, setSelectedDoctorForSignature] = useState<{ id: string; nome: string } | null>(null);

  // Estados de Unidades
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);

  const { data: session } = useSession();
  const router = useRouter();

  // Tracking de Dispositivo
  useEffect(() => {
    if (session?.user?.id) {
      const info = getDeviceInfo();
      fetch("/api/user/device", {
        method: "POST",
      }).catch((err) => console.warn("Erro ao rastrear dispositivo:", err));
    }
  }, [session]);

  // Ping de Presença (Para médicos/enfermeiros ficarem 'online' na telemedicina)
  useEffect(() => {
    if (!session?.user?.id) return;
    const tipo = (session.user as any).tipo_usuario?.toLowerCase() || "";
    if (!["medico", "enfermeiro"].includes(tipo)) return;

    const ping = async () => {
      try {
        await fetch("/api/medicos/ping", { method: "POST" });
      } catch (err) {
        console.warn("Erro no ping de presença:", err);
      }
    };

    ping(); // Ocorre assim que montar a gestão da fila
    const interval = setInterval(ping, 60000); // 1 minuto
    return () => clearInterval(interval);
  }, [session]);

  // --- ADMIN MGMT ---
  const [adminData, setAdminData] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  
  // Componente Switch reutilizável
  const Switch = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (val: boolean) => void }) => (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-gray-700 dark:text-gray-200 font-medium">{label}</span>
      <div className="relative">
        <input 
          type="checkbox" 
          className="sr-only peer" 
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-all duration-300" />
        <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-md transform peer-checked:translate-x-5 transition-all duration-300" />
      </div>
    </label>
  );


  // Carregar histórico com paginação e busca
  useEffect(() => {
    setHistorico([]);
    setPageFila(1);
    setHasMoreFila(true);
    fetchHistoricoAll(1, true);
  }, [enfermeiroId, searchFila, subAbaClassificacao, subAbaStatus, modoTeste]);

  async function fetchHistoricoAll(page: number, replace = false) {
    if (loading && !replace) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/historico-all?page=${page}&limit=20&search=${searchFila}&classificacao=${subAbaClassificacao}&statusFila=${subAbaStatus}&teste=${modoTeste}&v=${Date.now()}`);
      const data = await res.json();
      
      const formatados = data.map((h: any) => ({
        id: h.id,
        nome: h.categoria || "Relato",
        data: new Date(h.data_cadastro).toLocaleDateString("pt-BR"),
        descricao: h.descricao,
        status: h.status || "Iniciado",
        sintomas: h.sintomas || [],
        classificacao: h.classificacao || "Não classificado",
        checkinDataHora: h.checkin_data_hora || undefined,
        pacienteNome: h.paciente_nome || "Não informado",
        pacienteSexo: h.sexo || h.paciente_sexo || "Não informado",
        pacienteIdade: h.paciente_idade || 0,
        pacienteSUS: h.paciente_sus || "Não informado",
        historicoAtualizacao: h.historico_atualizacao || null,
        statusCheckin: h.status === "checkin" ? "checkin" : "",
        dataCadastro: h.data_cadastro,
        tempoTranscricao: h.tempo_transcricao,
      }));

      if (formatados.length < 20) setHasMoreFila(false);
      
      setHistorico(prev => replace ? formatados : [...prev, ...formatados]);
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
      // Garante um tempo mínimo de Splash Screen para não piscar
      setTimeout(() => {
        setIsInitialLoading(false);
      }, 800);
    }
  }

  // Carregar dados para relatórios (sem filtros de triagem e com limite maior)
  useEffect(() => {
    if (abaAtiva === "relatorios") {
      fetchHistoricoRelatorio();
    }
  }, [abaAtiva]);

  async function fetchHistoricoRelatorio() {
    setLoadingRelatorio(true);
    try {
      // Busca os últimos 500 registros para os relatórios serem mais precisos
      const res = await fetch(`/api/historico-all?page=1&limit=500&search=&classificacao=todas&teste=${modoTeste}&v=${Date.now()}`);
      const data = await res.json();
      
      const formatados = data.map((h: any) => ({
        id: h.id,
        nome: h.categoria || "Relato",
        data: new Date(h.data_cadastro).toLocaleDateString("pt-BR"),
        descricao: h.descricao,
        status: h.status || "Iniciado",
        sintomas: h.sintomas || [],
        classificacao: h.classificacao || "Não classificado",
        checkinDataHora: h.checkin_data_hora || undefined,
        pacienteNome: h.paciente_nome || "Não informado",
        pacienteSexo: h.sexo || h.paciente_sexo || "Não informado",
        pacienteIdade: h.paciente_idade || 0,
        pacienteSUS: h.paciente_sus || "Não informado",
        historicoAtualizacao: h.historico_atualizacao || null,
        statusCheckin: h.status === "checkin" ? "checkin" : "",
        dataCadastro: h.data_cadastro,
        tempoTranscricao: h.tempo_transcricao,
      }));
      
      setHistoricoRelatorio(formatados);
    } catch (err) {
      console.error("Erro ao carregar dados para relatórios:", err);
    } finally {
      setLoadingRelatorio(false);
    }
  }

  const loadMoreFila = () => {
    if (!loading && hasMoreFila) {
      const nextPage = pageFila + 1;
      setPageFila(nextPage);
      fetchHistoricoAll(nextPage);
    }
  };

  // -------- ADMIN FETCH --------
  const searchParams = useSearchParams();
  const abaQuery = searchParams.get("aba");
  const actionQuery = searchParams.get("action");

  // Ajustar aba inicial baseada na query string
  useEffect(() => {
    if (abaQuery === "pacientes" || abaQuery === "medicos" || abaQuery === "enfermeiros" || abaQuery === "gestores" || abaQuery === "unidades") {
      setAbaLista(abaQuery as any);
      if (actionQuery === "new") {
        setEditingUser(null);
        setIsModalOpen(true);
      }
    }
  }, [abaQuery, actionQuery]);

  useEffect(() => {
    if (abaAtiva === "listas" && (abaLista === "medicos" || abaLista === "enfermeiros" || abaLista === "gestores" || abaLista === "pacientes" || abaLista === "unidades")) {
      setAdminData([]);
      setPageAdmin(1);
      setHasMoreAdmin(true);
      fetchAdminData(1, true);
    }
  }, [abaLista, abaAtiva, searchTerm]);

  async function fetchAdminData(page = 1, replace = false) {
    setAdminLoading(true);
    try {
      let tipo = "";
      if (abaLista === "medicos") tipo = "medico";
      if (abaLista === "enfermeiros") tipo = "enfermeiro";
      if (abaLista === "gestores") tipo = "gestor";
      if (abaLista === "pacientes") tipo = "paciente";
      if (abaLista === "unidades") {
        const res = await fetch(`/api/admin/unidades?teste=${modoTeste}&search=${searchTerm}&v=${Date.now()}`);
        const data = await res.json();
        setAdminData(data);
        setHasMoreAdmin(false); // Admin unidades por enquanto sem paginação pois são poucas
        return;
      }

      const res = await fetch(`/api/admin/users?tipo=${tipo}&search=${searchTerm}&page=${page}&limit=20&v=${Date.now()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        if (data.length < 20) setHasMoreAdmin(false);
        else setHasMoreAdmin(true);
        
        setAdminData(prev => replace ? data : [...prev, ...data]);
        if (replace) setPageAdmin(1);
      }
    } catch (err) {
      toast.error("Erro ao carregar dados administrativos");
    } finally {
      setAdminLoading(false);
      setTimeout(() => {
        setIsInitialLoading(false);
      }, 800);
    }
  }

  const loadMoreAdmin = () => {
    if (!adminLoading && hasMoreAdmin) {
      const nextPage = pageAdmin + 1;
      setPageAdmin(nextPage);
      fetchAdminData(nextPage);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const endpoint = abaLista === "unidades" ? "/api/admin/unidades" : "/api/admin/users";
      const queryParams = abaLista === "unidades" ? `?id=${id}&teste=${modoTeste}` : `?id=${id}`;
      const res = await fetch(`${endpoint}${queryParams}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(abaLista === "unidades" ? "Unidade removida" : "Usuário removido");
        fetchAdminData();
      } else {
        toast.error("Erro ao remover");
      }
    } catch (err) {
      toast.error("Erro de conexão");
    }
  };


  // -------- DADOS PARA GRÁFICOS (Usando historicoRelatorio) --------
  const dataParaGraficos = historicoRelatorio.length > 0 ? historicoRelatorio : (loadingRelatorio ? [] : historico);

  const classificacaoData: { name: string; value: number }[] = Object.values(
    dataParaGraficos.reduce((acc: Record<string, { name: string; value: number }>, h) => {
      const key = h.classificacao || "Não classificado";
      acc[key] = acc[key] || { name: key, value: 0 };
      acc[key].value++;
      return acc;
    }, {})
  );

  // SEXO DINÂMICO
  const counts = dataParaGraficos.reduce((acc: any, h) => {
    const s = (h.pacienteSexo || "").toUpperCase();
    if (s.startsWith("M") || s === "MASCULINO") acc.m++;
    else if (s.startsWith("F") || s === "FEMININO") acc.f++;
    return acc;
  }, { m: 0, f: 0 });

  const sexoData = [
    { name: "Masculino", value: counts.m },
    { name: "Feminino", value: counts.f },
  ];

  // Triagens por Status
  const statusOrder = ["Iniciado", "Visto", "Check-in", "Finalizado"];
  const statusData: { name: string; value: number }[] = statusOrder.map((s) => {
    const count = dataParaGraficos.filter((h) => h.status.toLowerCase() === s.toLowerCase()).length;
    return { name: s, value: count };
  });

  // Criar um objeto para contar atendimentos por hora
  const horarioCounts: Record<string, number> = {};

  dataParaGraficos.forEach((h) => {
    if (h.dataCadastro) { // ou checkinDataHora, dependendo de onde quer pegar
      const date = new Date(h.dataCadastro);
      const hora = date.getHours(); // pega apenas a hora (0-23)
      const label = `${hora}h`;
      if (!horarioCounts[label]) horarioCounts[label] = 0;
      horarioCounts[label] += 1; // soma todos os atendimentos da mesma hora
    }
  });

  // Transformar em array e ordenar do maior para menor
  const horarioData = Object.entries(horarioCounts)
    .map(([hora, value]) => ({ name: hora, value }))
    .sort((a, b) => b.value - a.value);

  // Sintomas
  const sintomasData: { name: string; value: number }[] = Object.values(
    dataParaGraficos.reduce((acc: Record<string, { name: string; value: number }>, h) => {
      if (Array.isArray(h.sintomas)) {
        h.sintomas.forEach((s: any) => {
          if (!s) return;
          const sNome = typeof s === 'object' ? (s.nome || '') : s;
          const key = sNome.toString().trim();
          if (!key) return;
          acc[key] = acc[key] || { name: key, value: 0 };
          acc[key].value++;
        });
      }
      return acc;
    }, {})
  ).sort((a, b) => b.value - a.value).slice(0, 10);

  // Tempo de transcrição real vindo do banco
  const tempoTranscricaoData = dataParaGraficos
    .filter(h => h.tempoTranscricao !== undefined && h.tempoTranscricao !== null && Number(h.tempoTranscricao) > 0)
    .map((h, idx) => ({ 
      name: `${h.pacienteNome ? h.pacienteNome.split(' ')[0] : 'Pac.'} #${String(h.id).slice(-3)}`, 
      value: Number(h.tempoTranscricao)
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);


  const COLORS = ["#2563eb", "#22c55e", "#facc15", "#fb923c", "#dc2626", "#9ca3af"];

  const limitarTexto = (texto: string, limite: number) =>
    texto.length > limite ? texto.slice(0, limite) + "..." : texto;

  const getClassColor = (classificacao: string) => {
    switch (classificacao?.toLowerCase()) {
      case "azul":
        return "bg-blue-500";
      case "verde":
        return "bg-green-500";
      case "amarelo":
        return "bg-yellow-400 text-black";
      case "laranja":
        return "bg-orange-500";
      case "vermelho":
        return "bg-red-600";
      default:
        return "bg-gray-400";
    }
  };

  const calcTempoDecorrido = (dataCadastro?: string) => {
    if (!dataCadastro) return "—";
    const inicio = new Date(dataCadastro).getTime();
    const agora = new Date().getTime();
    const diff = agora - inicio;
    const horas = Math.floor(diff / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${horas}h ${minutos}m`;
  };

  return (
    <>
    {isInitialLoading && <Loader isDark={themeName === "dark"} />}
    
    <main className={`${tema.mainBg} min-h-screen ${isInitialLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}`}>
      <HeaderIn paginaAtiva="dashboard" tipoU={sessionServer?.user?.tipo_usuario || "gestor"} sessionServer={sessionServer} />
      <Toaster position="top-right" reverseOrder={false} />

      {/* Modal visualizar Detalhes Triagem */}
      {modalDetalheAberto && relatoParaModal && (
        <BottomSheetModal isOpen={modalDetalheAberto} onClose={() => { setModalDetalheAberto(false); setRelatoParaModal(null); }}>
          <div className="relative max-h-[75vh] overflow-y-auto p-6 space-y-6">
            <button
              onClick={() => { setModalDetalheAberto(false); setRelatoParaModal(null); }}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-600 dark:text-gray-400"
            >
              <FiX size={24} />
            </button>

            {/* Dados do paciente */}
            <div className="bg-white dark:bg-gray-800/80 backdrop-blur-sm p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl space-y-2">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg mb-3 border-b dark:border-gray-700 pb-2 flex items-center gap-2">
                <span className="w-1 h-5 bg-blue-600 rounded-full"></span>
                Identificação do Paciente
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <p className="text-gray-600 dark:text-gray-300">
                  <strong className="text-gray-800 dark:text-gray-100">Nome:</strong> {relatoParaModal.pacienteNome && relatoParaModal.pacienteNome !== "Não informado" ? relatoParaModal.pacienteNome : <span className="text-red-400 italic font-medium">Não informado</span>}
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  <strong className="text-gray-800 dark:text-gray-100">Sexo:</strong> {relatoParaModal.pacienteSexo || "Não informado"}
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  <strong className="text-gray-800 dark:text-gray-100">Idade:</strong> {relatoParaModal.pacienteIdade ? `${relatoParaModal.pacienteIdade} anos` : "Não informado"}
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  <strong className="text-gray-800 dark:text-gray-100">Número SUS:</strong> {relatoParaModal.pacienteSUS || "Não informado"}
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{relatoParaModal.pacienteNome}</h2>
              <p className="mt-3 text-gray-600 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700">
                {relatoParaModal.descricao}
              </p>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                Sintomas Relatados
              </h3>
              <div className="flex flex-wrap gap-2">
                {relatoParaModal?.sintomas?.length > 0 ? (
                  relatoParaModal.sintomas.map((s: any, i: number) => {
                    if (!s) return null;
                    const displayValue = typeof s === 'object' ? (s.nome || "") : s;
                    if (!displayValue) return null;
                    return (
                      <span key={i} className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-medium border border-blue-100 dark:border-blue-800">
                        {displayValue}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Nenhum sintoma detalhado informado.</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-6 items-center justify-between border-t dark:border-gray-700 pt-6">
              <div>
                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-2">Classificação Final</h3>
                <span className={`inline-block px-4 py-1.5 rounded-full font-bold text-white shadow-sm ${getClassColor(relatoParaModal.classificacao)}`}>
                  {relatoParaModal.classificacao}
                </span>
              </div>

              {relatoParaModal.status === "checkin" && relatoParaModal.checkinDataHora && (
                <div className="text-right">
                   <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Check-in Realizado</p>
                   <p className="text-green-600 dark:text-green-400 font-bold">
                    {new Date(relatoParaModal.checkinDataHora).toLocaleString("pt-BR")}
                   </p>
                </div>
              )}
            </div>
          </div>
        </BottomSheetModal>
      )}

      {/* TABS PRINCIPAL */}
      <div className="flex space-x-4 border-b border-gray-300 dark:border-gray-600 p-4">
        <button
          className={`px-6 py-2 text-lg font-semibold rounded-t-lg ${
            abaAtiva === "listas"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          }`}
          onClick={() => setAbaAtiva("listas")}
        >
          Listas
        </button>
        <button
          className={`px-6 py-2 text-lg font-semibold rounded-t-lg ${
            abaAtiva === "relatorios"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          }`}
          onClick={() => setAbaAtiva("relatorios")}
        >
          Relatórios
        </button>
        <button
          className={`px-6 py-2 text-lg font-semibold rounded-t-lg ${
            abaAtiva === "configuracoes"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          }`}
          onClick={() => setAbaAtiva("configuracoes")}
        >
          Configurações
        </button>
      </div>

      <div className="p-5 space-y-6">
        {abaAtiva === "configuracoes" ? (
          <div className="p-6 rounded-2xl shadow-xl bg-white dark:bg-gray-800 space-y-8 max-w-3xl mx-auto border border-gray-100 dark:border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-2">
                <FiSettings className="text-blue-600" /> Configurações do Sistema
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ajuste os parâmetros de funcionamento da plataforma e ative modos de homologação.</p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-xl border border-gray-100 dark:border-gray-700">
               <Switch label="Ativar Modo Teste / Homologação" checked={modoTeste} onChange={toggleModoTeste} />
               <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 pl-1 border-l-2 border-blue-500 ml-1">
                 Quando o Modo Teste estiver ativado, as consultas de unidades para a Triagem e o Mapa buscarão os dados da tabela <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">unidades_teste</code> em vez da <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">unidades</code> padrão. Ideal para testar novas filiais antes de irem para produção.
               </p>
            </div>
          </div>
        ) : abaAtiva === "relatorios" ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Por Classificação */}
            <div className="p-4 rounded-2xl shadow bg-white dark:bg-gray-800">
              <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
                Por classificação
              </h2>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={classificacaoData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {classificacaoData.map((h, idx) => {
                        let cor = "#9ca3af";
                        switch (h.name.toLowerCase()) {
                          case "azul": cor = "#2563eb"; break;
                          case "verde": cor = "#22c55e"; break;
                          case "amarelo": cor = "#facc15"; break;
                          case "laranja": cor = "#fb923c"; break;
                          case "vermelho": cor = "#dc2626"; break;
                        }
                        return <Cell key={idx} fill={cor} />;
                      })}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Por Sexo */}
            <div className="p-4 rounded-2xl shadow bg-white dark:bg-gray-800">
              <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
                Por sexo
              </h2>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sexoData} dataKey="value" nameKey="name" outerRadius={80} label>
                      {sexoData.map((s, idx) => (
                        <Cell key={idx} fill={s.name === "Masculino" ? "#2563eb" : "#f472b6"} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Por status */}
            <div className="p-4 rounded-2xl shadow bg-white dark:bg-gray-800">
              <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
                Por status
              </h2>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={statusData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#2563eb" fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Horários de Pico */}
            <div className="p-4 rounded-2xl shadow bg-white dark:bg-gray-800">
              <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
                Horários de pico
              </h2>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={horarioData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#dd2137ff" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sintomas */}
            <div className="p-4 rounded-2xl shadow bg-white dark:bg-gray-800">
              <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
                Sintomas mais frequentes
              </h2>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={sintomasData}>
                    <XAxis type="category" dataKey="name" />
                    <YAxis interval={0} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#facc15" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tempo Transcrição */}
            <div className="p-4 rounded-2xl shadow bg-white dark:bg-gray-800">
              <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
                Tempo de transcrição (s)
              </h2>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={tempoTranscricaoData}>
                    <XAxis type="category" dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : abaAtiva === "listas" ? (
          <>
            {/* -------- LISTAGEM -------- */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className={`text-xl font-semibold ${tema.textPrimary} flex items-center gap-3`}>
                Gestão
                <button
                  onClick={() => router.push('/paciente/arvore')}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm"
                >
                  <FiSearch size={14} />
                  EXPLORADOR CLÍNICO
                </button>
              </h2>

              {abaLista === "fila" && (
                <div className="relative w-full md:w-80">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar triagem por Nome, CPF ou Classificação..."
                    className="pl-10 pr-4 py-2 w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition"
                    value={searchFila}
                    onChange={(e) => setSearchFila(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Abas da Listagem */}
            <div className="mt-4 flex gap-4 border-b border-gray-300 dark:border-gray-600 overflow-x-auto pb-1 no-scrollbar">
              {["fila", "pacientes", "medicos", "enfermeiros", "gestores", "unidades"].map((aba) => (
                <button
                  key={aba}
                  className={`pb-2 font-medium whitespace-nowrap px-1 ${
                    abaLista === aba
                      ? "border-b-2 border-blue-500 text-blue-500"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                  onClick={() => setAbaLista(aba as any)}
                >
                  {aba === "fila" ? "Triagem" : aba === "unidades" ? "Unidades de saúde" : aba.charAt(0).toUpperCase() + aba.slice(1)}
                </button>
              ))}
            </div>

            {/* Sub-abas de STATUS acima dos filtros de cor */}
            {abaLista === "fila" && (
              <div className="mt-4 px-1">
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: "todas",       label: "Todas",                bg: "bg-gray-600",    ring: "ring-gray-400" },
                    { id: "abertas",     label: "Abertas",              bg: "bg-amber-500",   ring: "ring-amber-400" },
                    { id: "andamento",   label: "Em Andamento",         bg: "bg-blue-600",    ring: "ring-blue-400" },
                    { id: "finalizadas", label: "Finalizadas",          bg: "bg-emerald-600", ring: "ring-emerald-400" },
                    { id: "expiradas",   label: "Expiradas/Canceladas", bg: "bg-rose-600",    ring: "ring-rose-400" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSubAbaStatus(s.id);
                        setHistorico([]);
                        setPageFila(1);
                        setHasMoreFila(true);
                      }}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border ${
                        subAbaStatus === s.id
                          ? `${s.bg} text-white border-transparent ring-2 ${s.ring} ring-offset-1 shadow-md`
                          : `bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:shadow`
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {abaLista === "fila" && (
              <div className="mt-4 px-1">
                <div className="flex gap-2.5 overflow-x-auto pb-4 pt-1 no-scrollbar -mx-1 px-1">
                  {[
                    { id: "todas", label: "Todas" },
                    { id: "Vermelho", label: "vermelho", color: "bg-red-600", shadow: "shadow-red-500/20" },
                    { id: "Laranja", label: "laranja", color: "bg-orange-500", shadow: "shadow-orange-500/20" },
                    { id: "Amarelo", label: "amarelo", color: "bg-yellow-400", shadow: "shadow-yellow-500/20" },
                    { id: "Verde", label: "verde", color: "bg-green-500", shadow: "shadow-green-500/20" },
                    { id: "Azul", label: "azul", color: "bg-blue-500", shadow: "shadow-blue-500/20" },
                    { id: "Não classificado", label: "Sem classif.", color: "bg-gray-400", shadow: "shadow-gray-500/20" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSubAbaClassificacao(c.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2.5 whitespace-nowrap min-w-max border ${
                        subAbaClassificacao === c.id
                          ? `border-transparent ring-2 ring-offset-2 ring-blue-500 scale-105 shadow-lg ${c.shadow} ${c.color || "bg-blue-600"} ${c.id === "Amarelo" ? "text-black" : "text-white"}`
                          : `bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md`
                      }`}
                    >
                      {c.color && (
                        <span className={`relative flex h-2.5 w-2.5`}>
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c.color} opacity-20`}></span>
                          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${c.color} border border-white/30`}></span>
                        </span>
                      )}
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {abaLista === "fila" ? (
              loading && historico.length === 0 ? (
                /* Skeleton Loader para Triagem */
                <div className="grid gap-3 md:grid-cols-1 mt-6 animate-pulse">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="p-4 rounded-lg bg-gray-200 dark:bg-gray-700 h-24 mb-3" />
                  ))}
                </div>
              ) : historico.length === 0 ? (
                <p className="mt-6 text-gray-500 dark:text-gray-300">Nenhum histórico encontrado.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-1 mt-6">
                  {historico.map((h, idx) => (
                    <div
                      key={`${h.id}-${idx}`}
                      className={`relative p-4 rounded-lg shadow-md border ${tema.borderColor} bg-white dark:bg-gray-800 hover:shadow-lg transition`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-sm font-bold text-blue-600 dark:text-blue-400 capitalize mb-1`}>
                            {h.pacienteNome}
                          </h3>
                          <h3 className={`text-sm font-semibold ${tema.textPrimary}`}>
                            {limitarTexto(h.descricao, 30)}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                            {h.data}
                          </p>
                          <div className="mt-1 inline-block border border-gray-400 dark:border-gray-600 rounded px-2 py-0.5 text-xs font-medium">
                            {calcTempoDecorrido(h.dataCadastro)}
                          </div>
                          {h.status === "checkin" && h.checkinDataHora && (
                            <p className="text-xs text-green-600 mt-1">
                              Check-in em {new Date(h.checkinDataHora).toLocaleString("pt-BR")}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex gap-2">
                            <FiEye 
                              className="text-gray-500 hover:text-blue-500 cursor-pointer transition-colors" 
                              size={20} 
                              onClick={() => {
                                setRelatoParaModal(h);
                                setModalDetalheAberto(true);
                              }}
                            />
                          </div>
                          <span className="mt-2 inline-block px-2 py-0.5 text-xs rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium">
                            {h.status}
                          </span>
                          <span className={`mt-1 inline-block px-2 py-0.5 text-xs rounded-md font-medium text-white ${getClassColor(h.classificacao)}`}>
                            {h.classificacao || "Não classificado"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {hasMoreFila && (
                    <button
                      onClick={loadMoreFila}
                      className="mt-4 w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium"
                    >
                      {loading ? "Carregando..." : "Ver mais relatos"}
                    </button>
                  )}
                </div>
              )
            ) : (
              <div className="mt-6">
                <ManagementTable
                  title={abaLista.charAt(0).toUpperCase() + abaLista.slice(1)}
                  data={adminData}
                  loading={adminLoading}
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  onAdd={() => {
                    if (abaLista === "unidades") {
                      setEditingUnit(null);
                      setIsUnitModalOpen(true);
                    } else {
                      setEditingUser(null);
                      setIsModalOpen(true);
                    }
                  }}
                  onEdit={(item) => {
                    if (abaLista === "unidades") {
                      setEditingUnit(item);
                      setIsUnitModalOpen(true);
                    } else {
                      setEditingUser(item);
                      setIsModalOpen(true);
                    }
                  }}
                  onDelete={handleDeleteUser}
                  onLoadMore={loadMoreAdmin}
                  hasMore={hasMoreAdmin}
                  addButtonLabel={`Cadastrar ${abaLista === "gestores" ? "gestor" : abaLista === "enfermeiros" ? "enfermeiro" : abaLista === "medicos" ? "médico" : abaLista === "unidades" ? "unidade" : "paciente"}`}
                  columns={abaLista === "unidades" ? [
                    { key: "nome", label: "Unidade", render: (u) => (
                      <div className="flex items-center gap-2 font-bold text-blue-600 dark:text-blue-400">
                        <FiHome /> {u.nome}
                      </div>
                    )},
                    { key: "tipo", label: "Tipo" },
                    { key: "endereco", label: "Endereço", render: (u) => (
                      <div className="max-w-xs truncate" title={u.endereco}>{u.endereco}</div>
                    )},
                    { key: "coordenadas", label: "Localização", render: (u) => (
                      <div className="flex items-center gap-1 text-[10px] font-mono opacity-50">
                        <FiMap /> {parseFloat(u.lat).toFixed(4)}, {parseFloat(u.lng).toFixed(4)}
                      </div>
                    )},
                    { key: "contato", label: "Contatos", render: (u) => (
                      <div className="text-xs">
                        {u.telefone && <div>Tel: {u.telefone}</div>}
                        {u.whatsapp && <div className="text-green-600 font-bold">Zap: {u.whatsapp}</div>}
                      </div>
                    )}
                  ] : [
                    { key: "nome", label: "Nome", render: (u) => (
                      <div className="flex items-center gap-2">
                        {u.nome}
                        {u.is_monitored && (
                          <FiAlertCircle className="text-red-500 animate-pulse" title="Usuário em Monitoração" />
                        )}
                      </div>
                    )},
                    { key: "documento", label: "CPF" },
                    ...(abaLista === "pacientes" ? [{ key: "nome_mae", label: "Mãe" }] : []),
                    ...(abaLista === "medicos" ? [{ key: "crm", label: "CRM" }, { key: "especialidade", label: "Especialidade" }] : []),
                    ...(abaLista === "enfermeiros" ? [{ key: "crm", label: "COREN" }] : []),
                    { key: "telefone", label: "Telefone" },
                    { key: "tipo_usuario", label: "Tipo", render: (u) => (
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-bold uppercase">
                        {u.tipo_usuario}
                      </span>
                    )},
                  ]}
                  renderCustomActions={(u) => (
                    abaLista === "medicos" ? (
                      <button
                        onClick={() => {
                          setSelectedDoctorForSignature({ id: u.id, nome: u.nome });
                          setIsSignatureModalOpen(true);
                        }}
                        className={`p-2 rounded-lg transition flex items-center gap-1.5 ${
                          u.has_signature 
                            ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100" 
                            : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                        title={u.has_signature ? "Assinatura Configurada" : "Configurar Assinatura Digital"}
                      >
                        <FiEdit3 size={18} />
                        {u.has_signature && <FiCheckCircle size={12} className="text-emerald-500 animate-pulse" />}
                      </button>
                    ) : null
                  )}
                />
              </div>
            )}
          </>
        ) : (
          <div className="hidden">
            {/* Configurações ocultas por solicitação */}
          </div>
        )}
      </div>
    </main>
    
    <UserFormModal
      isOpen={isModalOpen}
      onClose={() => {
        setIsModalOpen(false);
        setEditingUser(null);
      }}
      onSuccess={() => {
        fetchAdminData(1, true);
      }}
      user={editingUser}
      tipoInicial={
        abaLista === "gestores" ? "gestor" : 
        abaLista === "fila" ? "paciente" : 
        abaLista === "pacientes" ? "paciente" :
        abaLista.endsWith("es") ? abaLista.slice(0, -2) : 
        abaLista.endsWith("s") ? abaLista.slice(0, -1) : abaLista
      }
    />

    {selectedDoctorForSignature && (
      <DigitalSignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => {
          setIsSignatureModalOpen(false);
          setSelectedDoctorForSignature(null);
          // Recarregar dados para refletir status da assinatura na tabela
          fetchAdminData(1, true);
        }}
        medicoId={selectedDoctorForSignature.id}
        medicoNome={selectedDoctorForSignature.nome}
      />
    )}

    <UnitFormModal
      isOpen={isUnitModalOpen}
      onClose={() => {
        setIsUnitModalOpen(false);
        setEditingUnit(null);
      }}
      onSuccess={() => {
        fetchAdminData(1, true);
      }}
      unit={editingUnit}
      isTeste={modoTeste}
    />
    </>
  );
}
