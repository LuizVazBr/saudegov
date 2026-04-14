"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "@/components/ThemeProvider";
import toast, { Toaster } from "react-hot-toast";
import { FiBell, FiSend, FiUsers, FiUser, FiInfo } from "react-icons/fi";

export default function TestarNotificacoes() {
    const { tema } = useTheme();
    const { data: session } = useSession();

    const [loading, setLoading] = useState(false);
    const [tipoEnvio, setTipoEnvio] = useState<"todos" | "especifico">("todos");
    const [formData, setFormData] = useState({
        usuarioId: "",
        titulo: "🏥 Cliv Telemedicina",
        mensagem: "Você tem uma nova atualização",
        url: "/historico"
    });

    const [resultado, setResultado] = useState<any>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResultado(null);

        try {
            const payload: any = {
                titulo: formData.titulo,
                mensagem: formData.mensagem,
                url: formData.url
            };

            // Só adiciona usuarioId se for envio específico
            if (tipoEnvio === "especifico" && formData.usuarioId) {
                payload.usuarioId = formData.usuarioId;
            }

            const res = await fetch("/api/notificar-triagem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success) {
                toast.success(`✅ ${data.message || 'Notificação adicionada à fila'}`);
                setResultado({
                    ...data,
                    info: `Job ID: ${data.jobId} - Status: ${data.status}`
                });
            } else {
                toast.error(`❌ ${data.error || 'Erro ao enviar notificação'}`);
                setResultado(data);
            }
        } catch (error) {
            console.error(error);
            toast.error("❌ Erro de conexão");
        } finally {
            setLoading(false);
        }
    };

    const exemplos = [
        {
            nome: "Triagem Concluída",
            titulo: "✅ Triagem Finalizada",
            mensagem: "Seu resultado está disponível para visualização",
            url: "/historico"
        },
        {
            nome: "Médico Disponível",
            titulo: "👨‍⚕️ Médico Aguardando",
            mensagem: "Dr. Silva está te esperando na videochamada",
            url: "/videochamada"
        },
        {
            nome: "Lembrete",
            titulo: "⏰ Lembrete de Consulta",
            mensagem: "Sua consulta é amanhã às 14h",
            url: "/historico"
        },
        {
            nome: "Aviso Urgente",
            titulo: "🚨 Atenção",
            mensagem: "Sistema em manutenção das 2h às 4h",
            url: "/"
        }
    ];

    return (
        <main className={`${tema.mainBg} min-h-screen p-6`}>
            <Toaster position="top-right" />

            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className={`text-3xl font-bold ${tema.textPrimary} mb-2 flex items-center gap-3`}>
                        <FiBell className="text-blue-500" size={32} />
                        Notificações Push
                    </h1>
                    <p className={`${tema.textSecondary}`}>
                        Envie notificações personalizadas para testar o sistema
                    </p>
                </div>

                {/* Info do Usuário Logado */}
                {session?.user && (
                    <div className={`p-4 rounded-lg border ${tema.borderColor} bg-blue-50 dark:bg-blue-900/20 mb-6 flex items-start gap-3`}>
                        <FiInfo className="text-blue-500 mt-1" size={20} />
                        <div>
                            <p className={`text-sm ${tema.textPrimary} font-semibold mb-1`}>
                                Seu ID de Usuário: <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">{session.user.id}</code>
                            </p>
                            <p className={`text-xs ${tema.textSecondary}`}>
                                Use este ID para testar envio específico para você mesmo
                            </p>
                        </div>
                    </div>
                )}

                {/* Tipo de Envio */}
                <div className={`p-6 rounded-xl shadow-lg border ${tema.borderColor} bg-white dark:bg-gray-800 mb-6`}>
                    <h2 className={`text-lg font-semibold ${tema.textPrimary} mb-4`}>Tipo de Envio</h2>

                    <div className="flex gap-4">
                        <button
                            onClick={() => setTipoEnvio("todos")}
                            className={`flex-1 p-4 rounded-lg border-2 transition flex items-center justify-center gap-2 ${tipoEnvio === "todos"
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                                : "border-gray-300 dark:border-gray-600 hover:border-blue-300"
                                }`}
                        >
                            <FiUsers size={20} />
                            <span className="font-semibold">Todos os Usuários</span>
                        </button>

                        <button
                            onClick={() => setTipoEnvio("especifico")}
                            className={`flex-1 p-4 rounded-lg border-2 transition flex items-center justify-center gap-2 ${tipoEnvio === "especifico"
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                                : "border-gray-300 dark:border-gray-600 hover:border-blue-300"
                                }`}
                        >
                            <FiUser size={20} />
                            <span className="font-semibold">Usuário Específico</span>
                        </button>
                    </div>
                </div>

                {/* Formulário */}
                <form onSubmit={handleSubmit} className={`p-6 rounded-xl shadow-lg border ${tema.borderColor} bg-white dark:bg-gray-800 mb-6`}>
                    <h2 className={`text-lg font-semibold ${tema.textPrimary} mb-4`}>Dados da Notificação</h2>

                    {tipoEnvio === "especifico" && (
                        <div className="mb-4">
                            <label className={`block text-sm font-medium ${tema.textPrimary} mb-2`}>
                                ID do Usuário
                            </label>
                            <input
                                type="text"
                                value={formData.usuarioId}
                                onChange={(e) => setFormData({ ...formData, usuarioId: e.target.value })}
                                placeholder="Ex: 123"
                                className={`w-full p-3 border rounded-lg ${tema.borderColor} dark:bg-gray-700 dark:text-white`}
                                required={tipoEnvio === "especifico"}
                            />
                        </div>
                    )}

                    <div className="mb-4">
                        <label className={`block text-sm font-medium ${tema.textPrimary} mb-2`}>
                            Título da Notificação
                        </label>
                        <input
                            type="text"
                            value={formData.titulo}
                            onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                            placeholder="Ex: 🏥 Nova Mensagem"
                            className={`w-full p-3 border rounded-lg ${tema.borderColor} dark:bg-gray-700 dark:text-white`}
                            required
                        />
                    </div>

                    <div className="mb-4">
                        <label className={`block text-sm font-medium ${tema.textPrimary} mb-2`}>
                            Mensagem
                        </label>
                        <textarea
                            value={formData.mensagem}
                            onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                            placeholder="Ex: Seu resultado está disponível"
                            rows={3}
                            className={`w-full p-3 border rounded-lg ${tema.borderColor} dark:bg-gray-700 dark:text-white`}
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label className={`block text-sm font-medium ${tema.textPrimary} mb-2`}>
                            URL de Destino (ao clicar)
                        </label>
                        <input
                            type="text"
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            placeholder="Ex: /historico"
                            className={`w-full p-3 border rounded-lg ${tema.borderColor} dark:bg-gray-700 dark:text-white`}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <FiSend size={20} />
                        {loading ? "Enviando..." : "Enviar Notificação"}
                    </button>
                </form>

                {/* Exemplos Rápidos */}
                <div className={`p-6 rounded-xl shadow-lg border ${tema.borderColor} bg-white dark:bg-gray-800 mb-6`}>
                    <h2 className={`text-lg font-semibold ${tema.textPrimary} mb-4`}>Exemplos Rápidos</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {exemplos.map((exemplo, idx) => (
                            <button
                                key={idx}
                                onClick={() => setFormData({
                                    ...formData,
                                    titulo: exemplo.titulo,
                                    mensagem: exemplo.mensagem,
                                    url: exemplo.url
                                })}
                                className={`p-3 border rounded-lg ${tema.borderColor} hover:bg-gray-50 dark:hover:bg-gray-700 transition text-left`}
                            >
                                <div className={`font-semibold ${tema.textPrimary} text-sm mb-1`}>
                                    {exemplo.nome}
                                </div>
                                <div className={`text-xs ${tema.textSecondary}`}>
                                    {exemplo.titulo}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Resultado */}
                {resultado && (
                    <div className={`p-6 rounded-xl shadow-lg border ${tema.borderColor} ${resultado.success ? "bg-green-50 dark:bg-green-900/20 border-green-200" : "bg-red-50 dark:bg-red-900/20 border-red-200"
                        }`}>
                        <h2 className={`text-lg font-semibold mb-3 ${resultado.success ? "text-green-700" : "text-red-700"}`}>
                            Resultado do Envio
                        </h2>
                        <pre className="text-sm overflow-auto">
                            {JSON.stringify(resultado, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </main>
    );
}
