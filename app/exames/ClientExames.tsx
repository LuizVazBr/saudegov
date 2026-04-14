"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";
import HeaderIn from "@/components/HeaderIn";
import BottomSheetModal from "@/components/BottomSheetModal";
import { FiFile, FiEye } from "react-icons/fi";
import toast, { Toaster } from "react-hot-toast";
import type { Session } from "next-auth";

// ===== Tipagem do exame =====
type Exame = {
  id: string;
  descricao: string;
  pdf_exame?: string | null;
  analise_ia?: AnaliseIA | null;
  data_cadastro: string;
};

type AnaliseIA = {
  tipo_exame: string;
  valores: {
    parametro: string;
    valor: string;
    unidade: string;
    referencia: string;
    status: "normal" | "alto" | "baixo" | "indeterminado";
  }[];
  observacoes: string;
};

interface ClientExamesProps {
  sessionServer?: Session | null;
}

export default function ClientExames({ sessionServer }: ClientExamesProps) {
  // 🔹 Sessão do cliente
  const { data: session, status, update } = useSession();
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // 🔹 Atualiza sessão do servidor ao logar
  useEffect(() => {
    if (status === "authenticated" && !sessionLoaded) {
      update().then(() => setSessionLoaded(true));
    }
  }, [status, update]);

  const { tema, themeName } = useTheme();
  const isDark = themeName === "dark";

  const [exames, setExames] = useState<Exame[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [exameSelecionado, setExameSelecionado] = useState<Exame | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [descricao, setDescricao] = useState("");

  // 🔹 Buscar exames do usuário apenas quando sessão carregada
  useEffect(() => {
    if (!sessionLoaded || !session?.user?.id) return;

    const fetchExames = async () => {
      try {
        const res = await fetch(`/api/exames?usuario_id=${session.user.id}`, {
          cache: "no-store", // 🚫 evita cache
        });
        const data: Exame[] = await res.json();
        setExames(data);
      } catch (err) {
        console.error("Erro ao buscar exames:", err);
        toast.error("Erro ao buscar exames");
      } finally {
        setLoading(false);
      }
    };

    fetchExames();
  }, [sessionLoaded, session?.user?.id]);

  const fecharModal = () => {
    setModalAberto(false);
    setExameSelecionado(null);
    setArquivo(null);
    setDescricao("");
  };

  const abrirModal = (exame: Exame) => {
    setExameSelecionado(exame);
    setModalAberto(true);
  };

  // 🔹 Incluir novo exame
  const incluirExame = () => {
    if (!arquivo || !descricao) {
      toast.error("Escolha um arquivo e informe a descrição!");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const pdfBase64 = reader.result?.toString().split(",")[1] || null;

      try {
        const res = await fetch("/api/exames", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usuario_id: session!.user!.id,
            descricao,
            pdf_exame: pdfBase64,
          }),
        });

        const novoExame: Exame = await res.json();
        setExames((prev) => [novoExame, ...prev]);
        toast.success("Exame incluído! Análise em processamento...");
        fecharModal();

        // Poll para atualizar análise quando estiver pronta
        setTimeout(() => {
          fetch(`/api/exames?usuario_id=${session!.user!.id}`, { cache: "no-store" })
            .then(r => r.json())
            .then(data => setExames(data))
            .catch(console.error);
        }, 10000); // Verifica após 10s
      } catch (err) {
        console.error(err);
        toast.error("Erro ao incluir exame!");
      }
    };
    reader.readAsDataURL(arquivo);
  };

  return (
    <main className={`${tema.mainBg} min-h-screen`}>
      <HeaderIn paginaAtiva="exames" tipoU="" sessionServer={sessionServer as Session} />
      <Toaster position="top-right" />

      <div className="p-5">
        <div className="flex justify-between items-center mb-4">
          <h1 className={`text-2xl font-bold ${tema.textPrimary}`}>Meus Exames</h1>
          <button
            className={`text-sm font-medium py-2 px-4 rounded-md transition
              ${isDark ? 'bg-gray-600 hover:bg-gray-500' : 'bg-blue-600 hover:bg-blue-700'}
              text-white`}
            onClick={() => setModalAberto(true)}
          >
            + Adicionar
          </button>
        </div>

        <p className={`text-sm text-gray-600 dark:text-gray-300 mb-6`}>
          Aqui você pode acompanhar os exames realizados, seus resultados e a data de cada um.
        </p>

        {loading ? (
          <p>Carregando exames...</p>
        ) : exames.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-300">Nenhum exame cadastrado.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
            {exames.map((e) => (
              <div
                key={e.id}
                className={`p-5 rounded-xl shadow-lg border ${tema.borderColor} bg-white dark:bg-gray-800 hover:shadow-2xl transition flex justify-between items-center`}
              >
                <div className="flex flex-col w-full">
                  <h2 className={`text-md font-semibold ${tema.textPrimary}`}>{e.descricao}</h2>
                  <span className="text-xs text-gray-500 dark:text-gray-300 mt-1 float-right">
                    {new Date(e.data_cadastro).toLocaleString()}
                  </span>
                </div>
                {e.pdf_exame && (
                  <div className="flex gap-3 ml-4">
                    <FiEye
                      size={22}
                      className="text-blue-500 cursor-pointer hover:text-blue-700 transition"
                      onClick={() => abrirModal(e)}
                      title="Ver detalhes e análise"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalAberto && (
        <BottomSheetModal isOpen={modalAberto} onClose={fecharModal} className="p-4">
          {exameSelecionado ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{exameSelecionado.descricao}</h2>
                <button onClick={fecharModal} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">✕</button>
              </div>
              <div className="flex flex-col space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">Data: {new Date(exameSelecionado.data_cadastro).toLocaleString()}</p>

                {/* Imagem do Exame */}
                {exameSelecionado.pdf_exame && (
                  exameSelecionado.pdf_exame.endsWith(".pdf") ? (
                    <a
                      href={exameSelecionado.pdf_exame}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline"
                    >
                      Abrir PDF
                    </a>
                  ) : (
                    <div className="flex flex-col items-center">
                      <img
                        src={exameSelecionado.pdf_exame}
                        alt="Exame"
                        className="max-h-64 object-contain mb-2 rounded border"
                      />
                      <a
                        href={exameSelecionado.pdf_exame}
                        download={`${exameSelecionado.descricao}.png`}
                        className="text-blue-500 underline text-sm"
                      >
                        Baixar Imagem
                      </a>
                    </div>
                  )
                )}

                {/* Análise IA */}
                {exameSelecionado.analise_ia ? (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">📊 Análise Automática</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      <strong>Tipo:</strong> {exameSelecionado.analise_ia.tipo_exame}
                    </p>

                    {exameSelecionado.analise_ia.valores && exameSelecionado.analise_ia.valores.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Valores Encontrados:</p>
                        {exameSelecionado.analise_ia.valores.map((v, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded text-sm ${v.status === "alto" ? "bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500" :
                              v.status === "baixo" ? "bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500" :
                                "bg-green-100 dark:bg-green-900/30 border-l-4 border-green-500"
                              }`}
                          >
                            <p className="font-medium text-gray-800 dark:text-gray-200">{v.parametro}</p>
                            <p className="text-gray-700 dark:text-gray-300">
                              <strong>Valor:</strong> {v.valor} {v.unidade}
                            </p>
                            {v.referencia && (
                              <p className="text-gray-600 dark:text-gray-400 text-xs">
                                Referência: {v.referencia}
                              </p>
                            )}
                            {v.status !== "normal" && v.status !== "indeterminado" && (
                              <p className="text-xs font-semibold mt-1">
                                ⚠️ {v.status === "alto" ? "Acima do normal" : "Abaixo do normal"}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {exameSelecionado.analise_ia.observacoes && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-3 italic">
                        {exameSelecionado.analise_ia.observacoes}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm text-gray-600 dark:text-gray-400">
                    ⏳ Análise automática em processamento...
                  </div>
                )}
              </div>
              <div className="flex gap-2 text-white">
                <button
                  onClick={fecharModal}
                  className={`flex-1 py-3 rounded-md font-semibold transition
                    ${isDark ? 'bg-gray-600 hover:bg-gray-500' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  Fechar
                </button>
                {exameSelecionado.analise_ia && (
                  <button
                    onClick={() => {
                      const texto = `*${exameSelecionado.descricao}*\n\n` +
                        `📊 *Análise Automática*\n` +
                        `Tipo: ${exameSelecionado.analise_ia!.tipo_exame}\n\n` +
                        `*Valores:*\n` +
                        exameSelecionado.analise_ia!.valores.map(v =>
                          `• ${v.parametro}: ${v.valor} ${v.unidade}\n` +
                          `  Referência: ${v.referencia}\n` +
                          `  Status: ${v.status === "alto" ? "⚠️ Alto" : v.status === "baixo" ? "⚠️ Baixo" : "✅ Normal"}`
                        ).join("\n\n") +
                        (exameSelecionado.analise_ia!.observacoes ? `\n\n${exameSelecionado.analise_ia!.observacoes}` : "");

                      const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
                      window.open(url, "_blank");
                    }}
                    className="flex-1 py-3 rounded-md bg-green-600 hover:bg-green-700 font-semibold transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    Compartilhar
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-2 mb-6">
                {/* Opção Arquivo */}
                <div
                  className="flex-1 flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-xl border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  onClick={() => document.getElementById("inputArquivo")?.click()}
                >
                  <FiFile className="text-3xl text-gray-400 mb-2" />
                  <p className="text-gray-500 dark:text-gray-300 text-xs text-center">PDF ou Imagem</p>
                  <input
                    type="file"
                    id="inputArquivo"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  />
                </div>

                {/* Opção Câmera */}
                <div
                  className="flex-1 flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-xl border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  onClick={() => document.getElementById("inputCamera")?.click()}
                >
                  <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className="text-3xl text-gray-400 mb-2" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  <p className="text-gray-500 dark:text-gray-300 text-xs text-center">Tirar Foto</p>
                  <input
                    type="file"
                    id="inputCamera"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              {arquivo && <p className="mb-4 text-center text-sm font-medium text-green-600 dark:text-green-400">Arquivo selecionado: {arquivo.name}</p>}
              <input
                type="text"
                placeholder="Descrição do exame"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full mb-4 px-3 py-2 border rounded-md"
              />
              <button
                onClick={incluirExame}
                className={`w-full py-3 rounded-md text-white font-semibold transition
                  ${isDark ? 'bg-gray-600 hover:bg-gray-500' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                Incluir Exame
              </button>
              <button
                onClick={fecharModal}
                className={`w-full mt-2 py-3 rounded-md text-white font-semibold transition
                  ${isDark ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-400 hover:bg-gray-500'}`}
              >
                Fechar
              </button>
            </>
          )}
        </BottomSheetModal>
      )}
    </main>
  );
}
