"use client";

import { useState, useEffect } from "react";
import { FiX, FiUser, FiMail, FiLock, FiSmartphone, FiCalendar, FiCreditCard, FiAlertCircle } from "react-icons/fi";
import { toast } from "react-hot-toast";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user?: any; // Se presente, é edição
  tipoInicial?: string;
}

export default function UserFormModal({ isOpen, onClose, onSuccess, user, tipoInicial }: UserFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    documento: "",
    telefone: "",
    tipo_usuario: tipoInicial || "paciente",
    senha: "",
    sexo: "M",
    data_nascimento: "",
    numero_sus: "",
    nome_mae: "",
    telefone_whatsapp: false,
    crm: "",
    especialidade: "",
    estado_atuacao: "TO",
    is_monitored: false,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        nome: user.nome || "",
        email: user.email || "",
        documento: user.documento || "",
        telefone: user.telefone || "",
        tipo_usuario: user.tipo_usuario || tipoInicial || "paciente",
        senha: "", // Não carregar senha
        sexo: user.sexo || "M",
        data_nascimento: user.data_nascimento ? user.data_nascimento.split("T")[0] : "",
        numero_sus: user.numero_sus || "",
        nome_mae: user.nome_mae || "",
        telefone_whatsapp: !!user.telefone_whatsapp,
        crm: user.crm || "",
        especialidade: user.especialidade || "",
        estado_atuacao: user.estado_atuacao || "TO",
        is_monitored: !!user.is_monitored,
      });
    } else {
      setFormData({
        nome: "",
        email: "",
        documento: "",
        telefone: "",
        tipo_usuario: tipoInicial || "paciente",
        senha: "",
        sexo: "M",
        data_nascimento: "",
        numero_sus: "",
        nome_mae: "",
        telefone_whatsapp: false,
        crm: "",
        especialidade: "",
        estado_atuacao: "TO",
        is_monitored: false,
      });
    }
  }, [user, tipoInicial, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const method = user ? "PUT" : "POST";
      const body = user ? { ...formData, id: user.id } : formData;

      const res = await fetch("/api/admin/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(user ? "Usuário atualizado!" : "Usuário criado com sucesso!");
        onSuccess();
        onClose();
      } else {
        toast.error(data.error || "Erro ao salvar usuário");
      }
    } catch (err) {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 p-6 border-b dark:border-gray-700 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {user ? "Editar Usuário" : `Cadastrar Novo ${formData.tipo_usuario.charAt(0).toUpperCase() + formData.tipo_usuario.slice(1)}`}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition">
            <FiX size={24} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nome */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome Completo</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  required
                  type="text"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
              </div>
            </div>

            {/* Documento (CPF) */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">CPF (Somente números)</label>
              <div className="relative">
                <FiCreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  required
                  type="text"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  value={formData.documento}
                  onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            {/* Telefone */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Telefone</label>
              <div className="relative">
                <FiSmartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                />
              </div>
            </div>

            {/* Data Nascimento */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Data de Nascimento</label>
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  value={formData.data_nascimento}
                  onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                />
              </div>
            </div>

            {/* Sexo */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sexo</label>
              <select
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.sexo}
                onChange={(e) => setFormData({ ...formData, sexo: e.target.value })}
              >
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            {/* Nome da Mãe */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome da Mãe</label>
              <input
                type="text"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                value={formData.nome_mae}
                onChange={(e) => setFormData({ ...formData, nome_mae: e.target.value })}
              />
            </div>

            {/* WhatsApp Check */}
            <div className="flex items-center space-x-2 pt-8">
              <input
                type="checkbox"
                id="whatsapp"
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                checked={formData.telefone_whatsapp}
                onChange={(e) => setFormData({ ...formData, telefone_whatsapp: e.target.checked })}
              />
              <label htmlFor="whatsapp" className="text-sm font-medium text-gray-700 dark:text-gray-300">Este telefone é WhatsApp?</label>
            </div>

            {/* Senha */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {user ? "Senha (deixe em branco para manter)" : "Senha de Acesso"}
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  required={!user}
                  type="password"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  value={formData.senha}
                  onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                />
              </div>
            </div>

            {/* Tipo de Usuário / Privilégio */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Perfil (Privilégio)</label>
              <select
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white border-blue-500/50"
                value={formData.tipo_usuario}
                onChange={(e) => setFormData({ ...formData, tipo_usuario: e.target.value })}
              >
                <option value="paciente">Paciente</option>
                <option value="medico">Médico</option>
                <option value="enfermeiro">Enfermeiro</option>
                <option value="gestor">Gestor</option>
              </select>
            </div>

            {/* Numero SUS (apenas para pacientes) */}
            {formData.tipo_usuario === "paciente" && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Número SUS</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  value={formData.numero_sus}
                  onChange={(e) => setFormData({ ...formData, numero_sus: e.target.value })}
                />
              </div>
            )}

            {/* Campos para Profissionais */}
            {(formData.tipo_usuario === "medico" || formData.tipo_usuario === "enfermeiro") && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {formData.tipo_usuario === "medico" ? "CRM" : "COREN"}
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                    value={formData.crm}
                    onChange={(e) => setFormData({ ...formData, crm: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado (UF)</label>
                  <input
                    type="text"
                    maxLength={2}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white uppercase"
                    value={formData.estado_atuacao}
                    onChange={(e) => setFormData({ ...formData, estado_atuacao: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Especialidade / Função</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                    value={formData.especialidade}
                    onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* Monitoração (Lista de Alerta) - Disponível para todos os tipos */}
            <div className="md:col-span-2 flex items-center space-x-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl">
              <input
                type="checkbox"
                id="is_monitored"
                className="w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500"
                checked={formData.is_monitored}
                onChange={(e) => setFormData({ ...formData, is_monitored: e.target.checked })}
              />
              <div className="flex flex-col">
                <label htmlFor="is_monitored" className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                  <FiAlertCircle className="inline" />
                  Ativar Monitoramento (Lista de Alerta)
                </label>
                <p className="text-xs text-red-600/70 dark:text-red-400/60 font-medium">
                  O usuário receberá avisos de responsabilidade legal ao realizar triagens detectadas como falsas ou fraudulentas.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Salvando..." : user ? "Salvar Alterações" : "Cadastrar Agora"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
