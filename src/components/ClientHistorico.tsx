"use client";

import { useState, useEffect } from "react";
import { FiEye } from "react-icons/fi";
import HeaderIn from "@/components/HeaderIn";
import BottomSheetModal from "@/components/BottomSheetModal";
import { useTheme } from "@/components/ThemeProvider";
import toast, { Toaster } from "react-hot-toast";
import { Session } from "next-auth";

interface Relato {
  id: number;
  nome: string;
  data: string;
  descricao: string;
  status: string;
  sintomas: string[];
  classificacao: string;
}

interface Props {
  sessionServer: Session;
}

export default function ClientHistorico({ sessionServer }: Props) {
  const { tema } = useTheme();
  const [historico, setHistorico] = useState<Relato[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [relatoSelecionado, setRelatoSelecionado] = useState<Relato | null>(null);

  // 🚫 Desregistrar SW antigo
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) =>
        regs.forEach((reg) => reg.unregister())
      );
    }
  }, []);

  // 🔹 Carregar histórico do servidor
  useEffect(() => {
    async function fetchHistorico() {
      try {
        if (!sessionServer?.user?.id) return;

        const res = await fetch(`/api/historico?pacienteId=${sessionServer.user.id}`, {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });

        const data = await res.json();
        if (!Array.isArray(data)) {
          console.warn("O endpoint /api/historico não retornou um array:", data);
          setHistorico([]);
          return;
        }

        setHistorico(
          data.map((h: any) => ({
            id: h.id,
            nome: h.categoria || "Relato",
            data: new Date(h.data_cadastro).toLocaleDateString("pt-BR"),
            descricao: h.descricao,
            status: h.status || "Sem status",
            sintomas: h.sintomas || [],
            classificacao: h.classificacao || "Não classificado",
          }))
        );
      } catch (err) {
        console.error("Erro ao carregar histórico:", err);
        toast.error("Erro ao carregar histórico");
        setHistorico([]);
      } finally {
        setLoading(false);
      }
    }

    fetchHistorico();
  }, [sessionServer]);

  const abrirModal = (relato: Relato) => {
    setRelatoSelecionado(relato);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setRelatoSelecionado(null);
  };

  const limitarTexto = (texto: string, limite: number) => {
    return texto.length > limite ? texto.slice(0, limite) + "..." : texto;
  };

  return (
    <main className={`${tema.mainBg} min-h-screen`}>
      <HeaderIn paginaAtiva="historico" tipoU="" sessionServer={sessionServer} />

      <div className="p-5">
        <h1 className={`text-2xl font-bold ${tema.textPrimary}`}>Histórico</h1>
        <p className={`mt-4 ${tema.textSecondary}`}>
          Todos os relatos de sintomas e interações realizadas.
        </p>

        {loading ? (
          <p className="mt-6 text-gray-500 dark:text-gray-300">Carregando histórico...</p>
        ) : historico.length === 0 ? (
          <p className="mt-6 text-gray-500 dark:text-gray-300">Nenhum histórico encontrado.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1 mt-6">
            {historico.map((h) => (
              <div
                key={h.id}
                className={`relative p-5 rounded-xl shadow-lg border ${tema.borderColor} bg-white dark:bg-gray-800 hover:shadow-2xl transition`}
              >
                <div className="flex items-start space-x-3">
                  <span className={`w-4 h-4 mt-2 rounded-full flex-shrink-0 ${
                  h?.classificacao === "verde"
                    ? "bg-green-500"
                    : h?.classificacao === "amarelo"
                    ? "bg-yellow-500"
                    : h?.classificacao === "vermelho"
                    ? "bg-red-500"
                    : "bg-gray-400"
                    }`}></span>

                  <div className="flex-1">
                    <h2 className={`text-md font-semibold ${tema.textPrimary}`}>
                      {limitarTexto(h.descricao, 20)}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                      {h.data}
                    </p>
                  </div>

                  <FiEye
                    className="text-gray-400 dark:text-gray-300 hover:text-blue-500 cursor-pointer mt-1"
                    size={22}
                    onClick={() => abrirModal(h)}
                  />
                </div>

                <div className="mt-3 inline-block px-3 py-1 text-sm rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium">
                  {h.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalAberto && relatoSelecionado && (
        <BottomSheetModal isOpen={modalAberto} onClose={fecharModal} className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">{relatoSelecionado.nome}</h2>
            <button onClick={fecharModal} className="p-1 rounded-full hover:bg-gray-200 transition">
              ✕
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {relatoSelecionado.descricao}
            </p>

            <div className="mt-4">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">Sintomas identificados:</h3>
              <ul className="list-disc ml-5 mt-2 text-sm text-gray-700 dark:text-gray-300">
                {relatoSelecionado?.sintomas?.length > 0 ? (
                  relatoSelecionado.sintomas.map((s: string, i: number) => <li key={i}>{s}</li>)
                ) : (
                  <li>Nenhum sintoma informado</li>
                )}
              </ul>
            </div>

            <div className="mt-4">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">Classificação de risco:</h3>
              <span
                className={`inline-block px-3 py-1 rounded-md font-medium text-white mt-2 ${
                  relatoSelecionado?.classificacao === "verde"
                    ? "bg-green-500"
                    : relatoSelecionado?.classificacao === "amarelo"
                    ? "bg-yellow-500"
                    : relatoSelecionado?.classificacao === "vermelho"
                    ? "bg-red-500"
                    : "bg-gray-400"
                }`}
              >
                {relatoSelecionado?.classificacao || "Não classificado"}
              </span>
            </div>
          </div>

          <button
            onClick={fecharModal}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-md transition"
          >
            Fechar
          </button>
        </BottomSheetModal>
      )}

      <Toaster position="top-right" />
    </main>
  );
}
