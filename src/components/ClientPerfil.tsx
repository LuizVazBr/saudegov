"use client";

import React, { useState } from "react";
import { Session } from "next-auth";
import HeaderPerfil from "@/components/HeaderIn";
import { useTheme } from "@/components/ThemeProvider";
import QRCode from "react-qr-code";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { FiCheckCircle, FiEdit2, FiSave, FiX, FiSmartphone, FiMonitor, FiTablet, FiClock, FiMapPin, FiActivity, FiHeart } from "react-icons/fi";
import { useSession } from "next-auth/react";

interface Props {
  sessionServer: Session;
}

export default function ClientPerfil({ sessionServer }: Props) {
  const { tema, themeName } = useTheme();
  const router = useRouter();
  const { update } = useSession();

  // Inicializa com a sessão (cache), mas verifica o banco logo em seguida
  const [confirmado, setConfirmado] = useState(sessionServer.user?.config?.dados_confirmados === true);
  const [editando, setEditando] = useState(false);
  const [loading, setLoading] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"dados" | "dispositivos" | "saude">("dados");
  const [dispositivos, setDispositivos] = useState<any[]>([]);

  // Dados de Saúde (Anamnese)
  const [saudeData, setSaudeData] = useState<any>({
    raca_cor: "",
    fumante: null,
    consumo_alcool: "",
    necessidades_especiais: null,
    historia_familia_diabetes: null,
    grau_familia_diabetes: "",
    historia_familia_cancer: null,
    grau_familia_cancer: "",
    tipo_cancer: "",
    atividades_fisicas: "",
    alergias: "",
    medicamentos_continuos: "",
    tipo_sanguineo: "",
    peso: "",
    altura: "",
    sono: "",
    agua: ""
  });
  const [editandoSaude, setEditandoSaude] = useState(false);
  const [loadingSaude, setLoadingSaude] = useState(false);

  // Helpers de formatação
  const formatCPF = (v: string) => {
    if (!v) return "";
    v = v.replace(/\D/g, "");
    if (v.length > 11) v = v.substring(0, 11);
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const formatPhone = (v: string) => {
    if (!v) return "";
    v = v.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    return v;
  };

  const [formData, setFormData] = useState({
    nome: sessionServer.user?.name || "",
    cpf: sessionServer.user?.documento || "",
    dataNascimento: sessionServer.user?.data_nascimento ? new Date(sessionServer.user.data_nascimento).toISOString().split('T')[0] : "",
    numeroSUS: sessionServer.user?.numero_sus || "",
    telefone: sessionServer.user?.telefone || "",
    email: sessionServer.user?.email || "",
    sexo: sessionServer.user?.sexo || "",
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let value = e.target.value;
    const name = e.target.name;

    // Máscara para celular
    if (name === "telefone") {
      value = formatPhone(value);
    }

    if (name === "cep") {
      const cleanCep = value.replace(/\D/g, "").slice(0, 8);
      if (cleanCep.length > 5) {
        value = cleanCep.slice(0, 5) + "-" + cleanCep.slice(5);
      } else {
        value = cleanCep;
      }

      if (cleanCep.length === 8) {
        buscarEnderecoPorCep(cleanCep);
      }
    }

    setFormData({ ...formData, [name]: value });
  };

  const buscarEnderecoPorCep = async (cepLimpo: string) => {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      setFormData(prev => ({
        ...prev,
        endereco: `${data.logradouro || ""} - ${data.bairro || ""} - ${data.localidade || ""}/${data.uf || ""}`
      }));
      toast.success("Endereço localizado!");
    } catch {
      toast.error("Erro ao buscar CEP");
    }
  };

  // Efeito para garantir sincronia com o banco de dados (bypassing Redis cache stale data)
  React.useEffect(() => {
    fetch("/api/perfil/status")
      .then(r => r.json())
      .then(data => {
        if (typeof data.dados_confirmados === "boolean") {
          setConfirmado(data.dados_confirmados);
        }
        if (data.endereco) {
          // Aplica máscara no CEP ao carregar
          let rawCep = data.endereco.cep || "";
          let maskedCep = rawCep;
          if (rawCep.length === 8) {
            maskedCep = rawCep.slice(0, 5) + "-" + rawCep.slice(5);
          }

          setFormData(prev => ({
            ...prev,
            cep: maskedCep,
            endereco: data.endereco.endereco || "",
            numero: data.endereco.numero || "",
            complemento: data.endereco.complemento || "",
          }));
        }
      })
      .catch(console.error);
  }, []);

  // Busca dispositivos ou saúde quando a aba muda
  React.useEffect(() => {
    if (abaAtiva === "dispositivos") {
      fetch("/api/user/devices")
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setDispositivos(data);
        })
        .catch(console.error);
    } else if (abaAtiva === "saude") {
      setLoadingSaude(true);
      fetch("/api/perfil/saude")
        .then(r => r.json())
        .then(data => {
          if (data && !data.error) {
            setSaudeData({
              ...data,
              peso: data.peso || "",
              altura: data.altura || ""
            });
          }
        })
        .catch(console.error)
        .finally(() => setLoadingSaude(false));
    }
  }, [abaAtiva]);

  // Ação: Confirmar que dados estão corretos
  const handleConfirmar = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/perfil/atualizar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmar_apenas: true })
      });

      if (res.ok) {
        setConfirmado(true);
        toast.success("Dados confirmados com sucesso!");
        await update(); // Força update da sessão no cliente para pegar o novo config
        router.refresh();
      } else {
        toast.error("Erro ao confirmar.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  // Ação: Salvar edições
  const handleSalvar = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/perfil/atualizar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formData.nome,
          numero_sus: formData.numeroSUS,
          telefone: formData.telefone.replace(/\D/g, ""), // Salpa limpo
          email: formData.email,
          sexo: formData.sexo,
          data_nascimento: formData.dataNascimento,
          cep: formData.cep.replace(/\D/g, ""),
          endereco: formData.endereco,
          numero: formData.numero,
          complemento: formData.complemento,
          confirmar_apenas: false
        })
      });

      if (res.ok) {
        setConfirmado(true);
        setEditando(false);
        toast.success("Dados atualizados e confirmados!");
        await update(); // Força update da sessão no cliente
        router.refresh();
      } else {
        toast.error("Erro ao atualizar.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  // Ação: Salvar Perfil de Saúde
  const handleSalvarSaude = async () => {
    setLoadingSaude(true);
    try {
      const res = await fetch("/api/perfil/saude", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saudeData)
      });

      if (res.ok) {
        setEditandoSaude(false);
        toast.success("Perfil de saúde atualizado!");
      } else {
        toast.error("Erro ao salvar perfil de saúde.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro de conexão.");
    } finally {
      setLoadingSaude(false);
    }
  };

  return (
    <main className={`${tema.mainBg} min-h-screen`}>
      <HeaderPerfil paginaAtiva="perfil" tipoU="" sessionServer={sessionServer} />
      <Toaster position="top-right" />

      <div className="p-5">
        <h1 className={`text-2xl font-bold ${tema.textPrimary} mb-4`}>Meu Perfil</h1>

        {/* Tab Switcher */}
        <div className="flex space-x-4 border-b border-gray-300 dark:border-gray-600 mb-6">
          <button
            className={`pb-2 px-1 font-semibold transition-colors ${
              abaAtiva === "dados"
                ? "border-b-2 border-blue-500 text-blue-500"
                : "text-gray-500 dark:text-gray-400"
            }`}
            onClick={() => setAbaAtiva("dados")}
          >
            Dados pessoais
          </button>
          <button
            className={`pb-2 px-1 font-semibold transition-colors ${
              abaAtiva === "saude"
                ? "border-b-2 border-blue-500 text-blue-500"
                : "text-gray-500 dark:text-gray-400"
            }`}
            onClick={() => setAbaAtiva("saude")}
          >
            Perfil de saúde
          </button>
          <button
            className={`pb-2 px-1 font-semibold transition-colors ${
              abaAtiva === "dispositivos"
                ? "border-b-2 border-blue-500 text-blue-500"
                : "text-gray-500 dark:text-gray-400"
            }`}
            onClick={() => setAbaAtiva("dispositivos")}
          >
            Dispositivos
          </button>
        </div>

        {abaAtiva === "dados" ? (
          <>

        {/* Se NÃO estiver confirmado, mostra o prompt. Se estiver confirmado, apenas a mensagem discreta ou nada. */}
        {!confirmado && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 mb-6 rounded-r">
            <p className={`text-sm md:text-base font-medium ${tema.textPrimary}`}>
              Deixe seu cadastro completo para agilizar o seu atendimento.
              <br />
              Confirme que as suas informações estão corretas.
            </p>
          </div>
        )}

        {confirmado && (
          <div className="mb-8 flex items-center space-x-2 text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
            <FiCheckCircle size={24} />
            <span className="font-semibold">Seus dados estão atualizados e confirmados. Obrigado!</span>
          </div>
        )}

        {/* Botões de Ação (Só aparecem se NÃO confirmado e NÃO editando) */}
        {!confirmado && !editando && (
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <button
              onClick={handleConfirmar}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center space-x-2 shadow-md disabled:opacity-50"
            >
              {loading ? <span>Processando...</span> : (
                <>
                  <FiCheckCircle size={20} />
                  <span>Sim, estão corretos</span>
                </>
              )}
            </button>

            <button
              onClick={() => setEditando(true)}
              disabled={loading}
              className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center space-x-2 shadow-md disabled:opacity-50"
            >
              <FiEdit2 size={18} />
              <span>Não, quero alterar</span>
            </button>
          </div>
        )}

        {/* --- MODO EDIÇÃO --- */}
        {editando ? (
          <div className={`p-5 rounded-xl shadow-lg border ${tema.borderColor} bg-white dark:bg-gray-800 transition mb-6 space-y-4`}>
            <div className="flex justify-between items-center mb-4 border-b pb-2 dark:border-gray-700">
              <h3 className={`font-bold ${tema.textPrimary}`}>Editar dados</h3>
              <button onClick={() => setEditando(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <FiX size={20} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome Completo</label>
              <input type="text" name="nome" value={formData.nome} onChange={handleInputChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CPF (Não editável)</label>
              <input
                type="text"
                name="cpf"
                value={formatCPF(formData.cpf)}
                disabled
                className="w-full p-2 border rounded-lg bg-gray-100 dark:bg-gray-600 dark:border-gray-500 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data de Nascimento</label>
              <input type="date" name="dataNascimento" value={formData.dataNascimento} onChange={handleInputChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número do SUS</label>
              <input type="text" name="numeroSUS" value={formData.numeroSUS} onChange={handleInputChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone / Celular</label>
              <input
                type="tel"
                name="telefone"
                value={formData.telefone}
                onChange={handleInputChange}
                maxLength={15}
                placeholder="(00) 00000-0000"
                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sexo</label>
              <select name="sexo" value={formData.sexo} onChange={handleInputChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                <option value="">Selecione</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div className="pt-4 border-t dark:border-gray-700">
              <h4 className={`font-bold ${tema.textPrimary} mb-3`}>Endereço</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CEP</label>
                <input type="text" name="cep" value={formData.cep} onChange={handleInputChange} placeholder="00000-000" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rua/Logradouro</label>
                <input type="text" name="endereco" value={formData.endereco} onChange={handleInputChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número</label>
                <input type="text" name="numero" value={formData.numero} onChange={handleInputChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Complemento</label>
                <input type="text" name="complemento" value={formData.complemento} onChange={handleInputChange} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button onClick={handleSalvar} disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50">
                <FiSave size={18} /> <span>{loading ? "Salvando..." : "Salvar Alterações"}</span>
              </button>
              <button onClick={() => setEditando(false)} disabled={loading} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          // --- MODO VISUALIZAÇÃO ---
          <div className={`p-5 rounded-xl shadow-lg border ${tema.borderColor} bg-white dark:bg-gray-800 transition mb-6 space-y-3 opacity-90`}>
            {/* Campos (Read-Only) */}
            <div className="flex flex-col md:flex-row md:justify-between border-b dark:border-gray-700 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Nome Completo</span>
              <span className={`text-base font-semibold ${tema.textPrimary}`}>{formData.nome || "-"}</span>
            </div>
            <div className="flex flex-col md:flex-row md:justify-between border-b dark:border-gray-700 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">CPF</span>
              <span className={`text-base font-semibold ${tema.textPrimary}`}>{formatCPF(formData.cpf) || "-"}</span>
            </div>
            <div className="flex flex-col md:flex-row md:justify-between border-b dark:border-gray-700 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Data de Nascimento</span>
              <span className={`text-base font-semibold ${tema.textPrimary}`}>
                {formData.dataNascimento ? new Date(formData.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-"}
              </span>
            </div>
            <div className="flex flex-col md:flex-row md:justify-between border-b dark:border-gray-700 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Número do SUS</span>
              <span className={`text-base font-semibold ${tema.textPrimary}`}>{formData.numeroSUS || "-"}</span>
            </div>
            <div className="flex flex-col md:flex-row md:justify-between border-b dark:border-gray-700 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Telefone</span>
              <span className={`text-base font-semibold ${tema.textPrimary}`}>{formatPhone(formData.telefone) || "-"}</span>
            </div>
            <div className="flex flex-col md:flex-row md:justify-between border-b dark:border-gray-700 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Email</span>
              <span className={`text-base font-semibold ${tema.textPrimary}`}>{formData.email || "-"}</span>
            </div>
            <div className="flex flex-col md:flex-row md:justify-between border-b dark:border-gray-700 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">CEP</span>
              <span className={`text-base font-semibold ${tema.textPrimary}`}>{formData.cep || "-"}</span>
            </div>
            <div className="flex flex-col md:flex-row md:justify-between border-b dark:border-gray-700 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Endereço</span>
              <span className={`text-base font-semibold ${tema.textPrimary}`}>
                {formData.endereco} {formData.numero ? `, ${formData.numero}` : ""} {formData.complemento ? ` - ${formData.complemento}` : ""}
              </span>
            </div>
            <div className="flex flex-col flex-wrap md:flex-row md:justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Sexo</span>
              <span className={`text-base font-semibold ${tema.textPrimary}`}>{formData.sexo || "-"}</span>
            </div>
          </div>
        )}

        {/* QR Code e Doc sempre visíveis */}
        {!editando && (
          <>
            <p className={`text-sm text-gray-600 dark:text-gray-300 mb-4 text-center mt-8`}>
              Mostre este QR Code ao médico para agilizar se atendimento.
            </p>

            <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg flex justify-center mb-6">
              <QRCode
                value={JSON.stringify({ id: sessionServer.user?.id || "0000", nome: formData.nome, sus: formData.numeroSUS })}
                size={180}
                bgColor={themeName === "dark" ? "#1F2937" : "#ffffff"}
                fgColor={themeName === "dark" ? "#ffffff" : "#000000"}
              />
            </div>

            <button
              type="button"
              className="w-full flex items-center justify-center space-x-2 px-6 py-2 font-medium rounded-lg transition text-white bg-blue-600 hover:bg-blue-700"
              onClick={() => router.push("/perfil/documentos")}
            >
              <svg
                stroke="currentColor"
                fill="none"
                strokeWidth="2"
                viewBox="0 0 24 24"
                strokeLinecap="round"
                strokeLinejoin="round"
                height="20"
                width="20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 5v14m7-7H5"></path>
              </svg>
              <span>Meus Documentos</span>
            </button>
          </>
        )}
      </>
    ) : abaAtiva === "saude" ? (
      /* --- ABA SAÚDE (ANAMNESE) --- */
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
          <div>
            <h2 className={`font-bold ${tema.textPrimary} flex items-center gap-2`}>
              <FiHeart className="text-red-500" /> Histórico clínico baseline
            </h2>
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Mantenha seus dados atualizados para triagens mais precisas</p>
          </div>
          {!editandoSaude && (
            <button 
              onClick={() => setEditandoSaude(true)}
              className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-blue-600 hover:text-blue-700 transition-all border border-blue-100"
              title="Editar perfil"
            >
              <FiEdit2 size={18} />
            </button>
          )}
        </div>

        {editandoSaude ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Seção Hábitos */}
            <div className={`p-5 rounded-xl border ${tema.borderColor} bg-white dark:bg-gray-800 space-y-4`}>
              <h3 className="text-xs font-black uppercase opacity-40 border-b pb-2 mb-4">Hábitos e Estilo de Vida</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/10">
                  <span className="text-sm font-medium">Você é fumante?</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSaudeData({...saudeData, fumante: true})}
                      className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${saudeData.fumante === true ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}
                    >
                      Sim
                    </button>
                    <button 
                      onClick={() => setSaudeData({...saudeData, fumante: false})}
                      className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${saudeData.fumante === false ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}
                    >
                      Não
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/10">
                  <span className="text-sm font-medium">Necessidades especiais?</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSaudeData({...saudeData, necessidades_especiais: true})}
                      className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${saudeData.necessidades_especiais === true ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}
                    >
                      Sim
                    </button>
                    <button 
                      onClick={() => setSaudeData({...saudeData, necessidades_especiais: false})}
                      className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${saudeData.necessidades_especiais === false ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}
                    >
                      Não
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase opacity-40 mb-1 ml-1">Consumo de álcool</label>
                  <select 
                    value={saudeData.consumo_alcool || ""} 
                    onChange={e => setSaudeData({...saudeData, consumo_alcool: e.target.value})}
                    className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  >
                    <option value="">Selecione</option>
                    <option value="Nunca">Nunca</option>
                    <option value="Raramente">Raramente</option>
                    <option value="Socialmente">Socialmente</option>
                    <option value="Frequentemente">Frequentemente</option>
                    <option value="Regularmente">Regularmente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase opacity-40 mb-1 ml-1">Atividades físicas</label>
                  <select 
                    value={saudeData.atividades_fisicas || ""} 
                    onChange={e => setSaudeData({...saudeData, atividades_fisicas: e.target.value})}
                    className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  >
                    <option value="">Selecione</option>
                    <option value="Sedentário">Sedentário</option>
                    <option value="Leve">Leve (1-2x semana)</option>
                    <option value="Moderado">Moderado (3-4x semana)</option>
                    <option value="Intenso">Intenso (5x+ semana)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase opacity-40 mb-1 ml-1">Qualidade do Sono</label>
                  <select 
                    value={saudeData.sono} 
                    onChange={e => setSaudeData({...saudeData, sono: e.target.value})}
                    className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  >
                    <option value="Ruim">Ruim</option>
                    <option value="Regular">Regular</option>
                    <option value="Bom">Bom</option>
                    <option value="Excelente">Excelente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase opacity-40 mb-1 ml-1">Ingestão de Água (Dia)</label>
                  <select 
                    value={saudeData.agua} 
                    onChange={e => setSaudeData({...saudeData, agua: e.target.value})}
                    className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  >
                    <option value="< 1L">&lt; 1 Litro</option>
                    <option value="1-2L">1 a 2 Litros</option>
                    <option value="> 2L">&gt; 2 Litros</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Seção Histórico Familiar */}
            <div className={`p-5 rounded-xl border ${tema.borderColor} bg-white dark:bg-gray-800 space-y-4`}>
              <h3 className="text-xs font-black uppercase opacity-40 border-b pb-2 mb-4">Histórico Familiar</h3>
              
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Histórico de diabetes na família?</span>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => setSaudeData({...saudeData, historia_familia_diabetes: true})}
                        className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${saudeData.historia_familia_diabetes === true ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}
                      >
                        Sim
                      </button>
                      <button 
                        onClick={() => setSaudeData({...saudeData, historia_familia_diabetes: false})}
                        className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${saudeData.historia_familia_diabetes === false ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}
                      >
                        Não
                      </button>
                    </div>
                  </div>
                  {saudeData.historia_familia_diabetes === true && (
                    <input 
                      type="text" 
                      placeholder="Qual o grau de parentesco? (ex: Pais, Avós)"
                      value={saudeData.grau_familia_diabetes}
                      onChange={e => setSaudeData({...saudeData, grau_familia_diabetes: e.target.value})}
                      className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    />
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Histórico de câncer na família?</span>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => setSaudeData({...saudeData, historia_familia_cancer: true})}
                        className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${saudeData.historia_familia_cancer === true ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}
                      >
                        Sim
                      </button>
                      <button 
                        onClick={() => setSaudeData({...saudeData, historia_familia_cancer: false})}
                        className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${saudeData.historia_familia_cancer === false ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}
                      >
                        Não
                      </button>
                    </div>
                  </div>
                  {saudeData.historia_familia_cancer === true && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                       <input 
                        type="text" 
                        placeholder="Grau de parentesco"
                        value={saudeData.grau_familia_cancer}
                        onChange={e => setSaudeData({...saudeData, grau_familia_cancer: e.target.value})}
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                      />
                       <input 
                        type="text" 
                        placeholder="Tipo de câncer (opcional)"
                        value={saudeData.tipo_cancer}
                        onChange={e => setSaudeData({...saudeData, tipo_cancer: e.target.value})}
                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Seção Biometria e Identificação */}
            <div className={`p-5 rounded-xl border ${tema.borderColor} bg-white dark:bg-gray-800 space-y-4`}>
              <h3 className="text-xs font-black uppercase opacity-40 border-b pb-2 mb-4">Perfil</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase opacity-40 mb-1 ml-1">Raça / Cor / Etnia</label>
                  <select 
                    value={saudeData.raca_cor} 
                    onChange={e => setSaudeData({...saudeData, raca_cor: e.target.value})}
                    className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  >
                    <option value="">Selecione</option>
                    <option value="Amarela">Amarela</option>
                    <option value="Branca">Branca</option>
                    <option value="Indígena">Indígena</option>
                    <option value="Parda">Parda</option>
                    <option value="Preta">Preta</option>
                    <option value="Outra">Outra</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase opacity-40 mb-1 ml-1">Tipo Sanguíneo</label>
                  <select 
                    value={saudeData.tipo_sanguineo} 
                    onChange={e => setSaudeData({...saudeData, tipo_sanguineo: e.target.value})}
                    className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  >
                    <option value="">Não sei</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-black uppercase opacity-40 mb-1 ml-1">Peso (kg)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={saudeData.peso}
                      onChange={e => setSaudeData({...saudeData, peso: e.target.value})}
                      className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase opacity-40 mb-1 ml-1">Altura (m)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={saudeData.altura}
                      onChange={e => setSaudeData({...saudeData, altura: e.target.value})}
                      className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

             {/* Seção Observações Médicas */}
             <div className={`p-5 rounded-xl border ${tema.borderColor} bg-white dark:bg-gray-800 space-y-4`}>
              <h3 className="text-xs font-black uppercase opacity-40 border-b pb-2 mb-4">Observações e Alertas</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase opacity-40 mb-1 ml-1">Alergias Conhecidas</label>
                  <textarea 
                    value={saudeData.alergias}
                    onChange={e => setSaudeData({...saudeData, alergias: e.target.value})}
                    placeholder="Liste medicamentos, alimentos ou substâncias..."
                    className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm h-20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase opacity-40 mb-1 ml-1">Medicamentos de Uso Contínuo</label>
                  <textarea 
                    value={saudeData.medicamentos_continuos}
                    onChange={e => setSaudeData({...saudeData, medicamentos_continuos: e.target.value})}
                    placeholder="Liste os medicamentos que você toma regularmente..."
                    className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm h-20"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleSalvarSaude} 
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg"
              >
                <FiSave size={20} /> Salvar perfil
              </button>
              <button 
                onClick={() => setEditandoSaude(false)} 
                className="flex-1 bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-gray-200 font-bold py-3 rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          /* Visualização de Saúde */
          <div className="space-y-4">
            <div className={`p-5 rounded-xl border ${tema.borderColor} bg-white dark:bg-gray-800 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6`}>
              <div>
                <p className="text-[10px] font-bold uppercase opacity-30 mb-1">Fumante</p>
                <p className={`text-sm font-bold ${saudeData.fumante === true ? 'text-red-500' : saudeData.fumante === false ? 'text-green-500' : 'text-gray-400'}`}>
                  {saudeData.fumante === true ? 'Sim' : saudeData.fumante === false ? 'Não' : '-'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase opacity-30 mb-1">Álcool</p>
                <p className="text-sm font-bold">{saudeData.consumo_alcool || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase opacity-30 mb-1">Ativ. física</p>
                <p className="text-sm font-bold">{saudeData.atividades_fisicas || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase opacity-30 mb-1">Sangue</p>
                <p className="text-sm font-bold text-red-600">{saudeData.tipo_sanguineo || '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-5 rounded-xl border ${tema.borderColor} bg-white dark:bg-gray-800 shadow-sm space-y-3`}>
                <h4 className="text-[10px] font-black uppercase opacity-40 border-b pb-2 mb-2">Genética & histórico</h4>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Diabetes na família</span>
                  <span className="text-sm font-bold">
                    {saudeData.historia_familia_diabetes === true 
                      ? `Sim (${saudeData.grau_familia_diabetes || '-'})` 
                      : saudeData.historia_familia_diabetes === false ? 'Não' : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Câncer na família</span>
                  <span className="text-sm font-bold">
                    {saudeData.historia_familia_cancer === true 
                      ? `Sim (${saudeData.grau_familia_cancer || '-'}${saudeData.tipo_cancer ? ` - ${saudeData.tipo_cancer}` : ''})` 
                      : saudeData.historia_familia_cancer === false ? 'Não' : '-'}
                  </span>
                </div>
              </div>

               <div className={`p-5 rounded-xl border ${tema.borderColor} bg-white dark:bg-gray-800 shadow-sm space-y-3`}>
                <h4 className="text-[10px] font-black uppercase opacity-40 border-b pb-2 mb-2">Identificação biometria</h4>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Etnia/cor</span>
                  <span className="text-sm font-bold">{saudeData.raca_cor || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Peso / altura</span>
                  <span className="text-sm font-bold">
                    {saudeData.peso ? `${saudeData.peso}kg` : '-'} / {saudeData.altura ? `${saudeData.altura}m` : '-'}
                  </span>
                </div>
              </div>
            </div>

            <div className={`p-5 rounded-xl border-l-4 border-l-red-500 border ${tema.borderColor} bg-white dark:bg-gray-800 shadow-md`}>
              <h4 className="text-[10px] font-black uppercase opacity-40 mb-3 flex items-center gap-2">
                <FiActivity className="text-red-500" /> Alertas e observações críticas
              </h4>
              <div className="space-y-4">
                 <div>
                    <p className="text-[9px] font-bold uppercase opacity-30">Alergias</p>
                    <p className="text-sm whitespace-pre-wrap">{saudeData.alergias || 'Nenhuma alergia relatada.'}</p>
                 </div>
                 <div>
                    <p className="text-[9px] font-bold uppercase opacity-30">Medicamentos contínuos</p>
                    <p className="text-sm whitespace-pre-wrap">{saudeData.medicamentos_continuos || 'Nenhum medicamento de uso contínuo.'}</p>
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>
    ) : (
      /* --- ABA DISPOSITIVOS --- */
          <div className="space-y-4">
            <p className={`text-sm ${tema.textSecondary}`}>
              Estes são os aparelhos que acessaram sua conta recentemente.
            </p>
            
            {dispositivos.length === 0 ? (
              <p className="text-gray-500 italic">Carregando dispositivos...</p>
            ) : (
              <div className="grid gap-4">
                {dispositivos.map((dev, idx) => (
                  <div 
                    key={dev.id} 
                    className={`p-4 rounded-xl border ${tema.borderColor} bg-white dark:bg-gray-800 shadow-sm flex items-center justify-between`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-full ${tema.badgeBg} ${tema.badgeText}`}>
                        {dev.tipo_dispositivo === "Celular" ? <FiSmartphone size={24} /> : 
                         dev.tipo_dispositivo === "Tablet" ? <FiTablet size={24} /> : 
                         <FiMonitor size={24} />}
                      </div>
                      <div>
                        <h4 className={`font-bold ${tema.textPrimary}`}>
                          {dev.modelo} • {dev.navegador} {dev.versao_navegador}
                        </h4>
                        <div className="flex flex-col space-y-0.5 mt-1">
                          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <FiClock className="mr-1" size={12} />
                            Visto em: {new Date(dev.ultima_atividade).toLocaleString("pt-BR")}
                          </div>
                          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <FiMapPin className="mr-1" size={12} />
                            IP: {dev.ip_address}
                          </div>
                        </div>
                      </div>
                    </div>
                    {idx === 0 && (
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                        Atual
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                Se você não reconhece algum destes dispositivos, recomendamos que altere sua senha imediatamente.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
