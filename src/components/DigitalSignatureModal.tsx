"use client";

import { useState, useEffect } from "react";
import { FiX, FiShield, FiLock, FiFile, FiUploadCloud, FiInfo, FiTrash2, FiCheckCircle, FiZap } from "react-icons/fi";
import { toast } from "react-hot-toast";

interface DigitalSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicoId: string;
  medicoNome: string;
}

type SignatureType = "vidaas" | "birdid" | "pfx" | "imagem";

export default function DigitalSignatureModal({
  isOpen,
  onClose,
  medicoId,
  medicoNome,
}: DigitalSignatureModalProps) {
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isConfigActive, setIsConfigActive] = useState(false);
  const [tipo, setTipo] = useState<SignatureType>("vidaas");
  const [formData, setFormData] = useState<any>({
    vidaas: { username: "", password: "", clientId: "", clientSecret: "" },
    birdid: { username: "", password: "", clientId: "", clientSecret: "" },
    pfx: { password: "", fileName: "", fileContent: "" },
    imagem: { fileName: "", fileContent: "" },
  });

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, "") // Remove tudo que não é dígito
      .replace(/(\d{3})(\d)/, "$1.$2") // Coloca ponto após os 3 primeiros dígitos
      .replace(/(\d{3})(\d)/, "$1.$2") // Coloca ponto após os 6 primeiros dígitos
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2") // Coloca hífen após os 9 primeiros dígitos
      .substring(0, 14); // Limita ao tamanho do CPF formatado
  };

  useEffect(() => {
    if (isOpen && medicoId) {
      fetchData();
    }
  }, [isOpen, medicoId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/medico/assinatura?medicoId=${medicoId}`);
      const data = await res.json();
      if (data && data.assinatura_tipo) {
        setIsConfigActive(true);
        setTipo(data.assinatura_tipo);
        const config = data.assinatura_config || {};
        setFormData((prev: any) => ({
          ...prev,
          [data.assinatura_tipo]: config,
        }));
      } else {
        setIsConfigActive(false);
      }
    } catch (err) {
      console.error("Erro ao carregar configurações:", err);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: "pfx" | "imagem") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (field === "imagem" && !file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem (PNG/JPG)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFormData({
        ...formData,
        [field]: {
          ...formData[field],
          fileName: file.name,
          fileContent: content, // Base64
        },
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/medico/assinatura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicoId,
          assinatura_tipo: tipo,
          assinatura_config: formData[tipo],
        }),
      });

      if (res.ok) {
        toast.success("Configuração de assinatura salva!");
        onClose();
      } else {
        const d = await res.json();
        toast.error(d.error || "Erro ao salvar");
      }
    } catch (err) {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm("Tem certeza que deseja remover esta configuração de assinatura?")) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/medico/assinatura?medicoId=${medicoId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Configuração removida com sucesso!");
        setIsConfigActive(false);
        setFormData({
          vidaas: { username: "", password: "", clientId: "", clientSecret: "" },
          birdid: { username: "", password: "", clientId: "", clientSecret: "" },
          pfx: { password: "", fileName: "", fileContent: "" },
        });
      } else {
        toast.error("Erro ao remover configuração");
      }
    } catch (err) {
      toast.error("Erro de conexão");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestConnection = async () => {
    setIsValidating(true);
    const toastId = toast.loading("Testando conexão...");
    
    try {
      // Normaliza o tipo para o que a API espera (Case Sensitive no backend)
      const tipoAPI = tipo === "vidaas" ? "Vidaas" : tipo === "birdid" ? "BirdID" : "PFX";
      
      const config = tipo === "pfx" 
        ? { pfxBase64: formData.pfx.fileContent, senha: formData.pfx.password }
        : { 
            cpf: formData[tipo].username, 
            senha: formData[tipo].password,
            clientId: formData[tipo].clientId,
            clientSecret: formData[tipo].clientSecret
          };

      const res = await fetch("/api/medico/assinatura/testar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: tipoAPI, config }),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success(result.message || "Conexão validada com sucesso!");
      } else {
        toast.error(result.error || "Erro na validação");
      }
    } catch (err) {
      toast.error("Erro ao conectar com o servidor");
    } finally {
      setIsValidating(false);
      toast.dismiss(toastId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Assinatura Digital
            </h2>
            <p className="text-blue-100 text-sm opacity-90">{medicoNome}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Selector */}
          <div className="flex items-center justify-between p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl gap-1">
            <div className="flex flex-1 gap-1">
              {(["vidaas", "birdid", "pfx", "imagem"] as SignatureType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all uppercase tracking-wider ${
                    tipo === t
                      ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {t === "imagem" ? "Carimbo" : t}
                </button>
              ))}
            </div>
            
            {isConfigActive && (
              <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest border border-emerald-200/50 dark:border-emerald-800/50 ml-2 animate-pulse">
                <FiCheckCircle size={12} /> Configurado
              </div>
            )}
          </div>

          <div className="space-y-4">
            {tipo === "pfx" ? (
              <div className="space-y-4">
                <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-900/40 hover:border-blue-400 transition cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pfx,.p12"
                    onChange={(e) => handleFileChange(e, "pfx")}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600">
                    <FiUploadCloud size={24} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm text-gray-700 dark:text-gray-200">
                      {formData.pfx.fileName || "Clique para enviar o arquivo .PFX"}
                    </p>
                    <p className="text-xs text-gray-500">Ou arraste e solte aqui</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                    <FiLock /> Senha do Certificado
                  </label>
                  <input
                    type="password"
                    placeholder="Sua senha secreta"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none dark:text-white transition"
                    value={formData.pfx.password}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pfx: { ...formData.pfx, password: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
            ) : tipo === "imagem" ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-900/40 hover:border-blue-400 transition cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "imagem")}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {formData.imagem.fileContent ? (
                    <img src={formData.imagem.fileContent} alt="Assinatura" className="max-h-32 object-contain" />
                  ) : (
                    <>
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600">
                        <FiFile size={24} />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-sm text-gray-700 dark:text-gray-200">
                          {formData.imagem.fileName || "Clique para enviar a imagem da assinatura"}
                        </p>
                        <p className="text-xs text-gray-500">PNG ou JPG com fundo transparente</p>
                      </div>
                    </>
                  )}
                </div>
                {formData.imagem.fileContent && (
                  <button 
                    onClick={() => setFormData({...formData, imagem: {fileName: "", fileContent: ""}})}
                    className="w-full text-xs text-red-500 flex items-center justify-center gap-1 hover:underline"
                  >
                    <FiTrash2 size={12} /> Remover imagem atual
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">CPF ou Usuário</label>
                    <input
                      type="text"
                      placeholder="Ex: 000.000.000-00 ou Número de Usuário"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none dark:text-white transition"
                      value={formData[tipo].username}
                      onChange={(e) => {
                        const formatted = tipo === "birdid" || tipo === "vidaas" ? formatCPF(e.target.value) : e.target.value;
                        setFormData({
                          ...formData,
                          [tipo]: { ...formData[tipo], username: formatted },
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                       Senha / PIN
                    </label>
                    <input
                      type="password"
                      placeholder="••••••"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none dark:text-white transition"
                      value={formData[tipo].password}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [tipo]: { ...formData[tipo], password: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Client ID</label>
                    <input
                      type="text"
                      placeholder="ID da Aplicação"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none dark:text-white transition text-sm"
                      value={formData[tipo].clientId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [tipo]: { ...formData[tipo], clientId: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Client Secret</label>
                    <input
                      type="password"
                      placeholder="Segredo da Aplicação"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none dark:text-white transition text-sm"
                      value={formData[tipo].clientSecret}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [tipo]: { ...formData[tipo], clientSecret: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex items-start gap-3">
                    <FiInfo className="text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
                        As credenciais serão utilizadas para requisitar a assinatura em tempo real via API do provedor selecionado.
                    </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700 flex flex-col gap-3">
          <div className="flex gap-3">
            {tipo !== "imagem" && (
              <button
                onClick={handleTestConnection}
                disabled={isValidating || loading}
                className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                <FiZap className="group-hover:animate-bounce" />
                {isValidating ? "Testando..." : "Testar Conexão"}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={loading || isValidating}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar Configuração"}
            </button>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-sm text-gray-500 font-bold hover:text-gray-700 dark:hover:text-gray-300 transition"
            >
              Fechar
            </button>
            {isConfigActive && (
              <button
                onClick={handleRemove}
                disabled={isDeleting}
                className="flex-1 py-2 text-sm text-red-500 font-bold hover:text-red-700 transition flex items-center justify-center gap-1"
              >
                <FiTrash2 size={14} /> {isDeleting ? "Removendo..." : "Remover Assinatura"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
