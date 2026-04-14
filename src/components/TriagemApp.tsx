"use client";

import { useState, useEffect, useRef } from "react";
import { FiEye, FiEdit3, FiX } from "react-icons/fi";
import { BiQrScan } from "react-icons/bi";
import HeaderIn from "@/components/HeaderIn";
import Loader from "@/components/Loader";
import BottomSheetModal from "@/components/BottomSheetModal";
import { useTheme } from "@/components/ThemeProvider";
import { BrowserQRCodeReader } from "@zxing/library";
import { toast, Toaster } from "react-hot-toast";
import { Session } from "next-auth";

interface Relato {
  id: string; // UUID
  nome: string;
  data: string;
  dataISO?: string;
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
}

interface TriagemAppProps {
  enfermeiroId: string;
  enfermeiroNome: string;
  sessionServer?: Session;
}

export default function TriagemApp({ enfermeiroId, enfermeiroNome, sessionServer }: TriagemAppProps) {
  const { tema } = useTheme();
  const [historico, setHistorico] = useState<Relato[]>([]);
  const [loading, setLoading] = useState(true);
  const [modoTeste, setModoTeste] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("cliv_modo_teste") === "true";
    }
    return false;
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'cliv_modo_teste') {
        setModoTeste(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const [modalAberto, setModalAberto] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [relatoSelecionado, setRelatoSelecionado] = useState<Relato | null>(null);

  // Campos do modal de edição
  const [classificacao, setClassificacao] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [pressao, setPressao] = useState("");
  const [frequencia, setFrequencia] = useState("");
  const [descricaoExtra, setDescricaoExtra] = useState("");

  // QR Code
  const [qrAberto, setQrAberto] = useState(false);
  const [qrResultado, setQrResultado] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);

  // Abas
  const [abaAtiva, setAbaAtiva] = useState<"pendentes" | "confirmados">("pendentes");

  const filtrarHistorico = () => {
    const lista = historico.filter((h) => h.status !== "finalizado"); // exclui finalizados de cara

    if (abaAtiva === "pendentes") {
        return lista.filter((h) => h.statusCheckin !== "checkin"); // só não checkin
    }

    if (abaAtiva === "confirmados") {
        return lista.filter((h) => h.statusCheckin === "checkin"); // só checkin
    }

    return lista;
  };


  const marcarComoVisto = async (historicoId: string) => {
    try {
      const res = await fetch("/api/historico/insert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ historico_id: historicoId, status: "visto" }),
      });
      const data = await res.json();

      if (data.message === "Já marcado como visto") return;

      setHistorico((prev) =>
        prev.map((h) => (h.id === historicoId ? { ...h, status: "visto" } : h))
      );
    } catch (err) {
      console.error("Erro ao marcar como visto:", err);
      toast.error("Erro ao marcar como visto");
    }
  };

  function calcTempoDecorrido(dataISO: string): string {
    const agora = new Date();
    const data = new Date(dataISO);

    let diff = Math.floor((agora.getTime() - data.getTime()) / 1000); // diferença em segundos

    const dias = Math.floor(diff / (60 * 60 * 24));
    diff -= dias * 60 * 60 * 24;

    const horas = Math.floor(diff / (60 * 60));
    diff -= horas * 60 * 60;

    const minutos = Math.floor(diff / 60);
    diff -= minutos * 60;

    const segundos = diff;

    let resultado = "";

    if (dias > 0) resultado += `${dias}d `;
    if (horas > 0 || dias > 0) resultado += `${horas}h `;
    if (minutos > 0 || horas > 0 || dias > 0) resultado += `${minutos}m `;
    resultado += `${segundos}s`;

    return resultado.trim();
  }


  // Carregar histórico
  useEffect(() => {
    async function fetchHistoricoAll() {
      try {
        const res = await fetch(`/api/historico-all?teste=${modoTeste}&v=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
          },
        });
        const data = await res.json();
        const rows = Array.isArray(data) ? data : (data.rows || []);

        setHistorico([]); // limpa histórico antigo
        setHistorico(
          data.map((h: any) => ({
            id: h.id,
            nome: h.categoria || "Relato",
            data: new Date(h.data_cadastro).toLocaleDateString("pt-BR"),
            dataISO: h.data_cadastro,
            descricao: h.descricao,
            status: h.status ? h.status : "Iniciado",
            sintomas: h.sintomas || [],
            classificacao: h.classificacao || "Não classificado",
            checkinDataHora: h.checkin_data_hora || undefined,
            pacienteNome: h.paciente_nome || "Não informado",
            pacienteSexo: h.paciente_sexo || "Não informado",
            pacienteIdade: h.paciente_idade || 0,
            pacienteSUS: h.paciente_sus || "Não informado",
            historicoAtualizacao: h.historico_atualizacao || null,
            statusCheckin: h.status === "checkin" ? "checkin" : "", // <-- seta inicial
          }))
        );
      } catch (err) {
        console.error("Erro ao carregar histórico:", err);
        toast.error("Erro ao carregar histórico");
      } finally {
        setLoading(false);
      }
    }
    fetchHistoricoAll();
  }, [enfermeiroId, modoTeste]);

  // Limitar e formatar inputs numéricos
  const handleTemperatura = (value: string) => {
    const numeric = value.replace(/[^0-9.,]/g, "");
    const formatted = numeric.replace(",", ".");
    setTemperatura(formatted);
  };

  const handlePressao = (value: string) => {
    let numeric = value.replace(/[^0-9/]/g, "");
    const parts = numeric.split("/");
    if (parts.length > 2) numeric = parts[0] + "/" + parts[1];
    setPressao(numeric);
  };

  const handleFrequencia = (value: string) => {
    const numeric = value.replace(/[^0-9]/g, "");
    setFrequencia(numeric);
  };

  const salvarEdicao = async () => {
    if (!relatoSelecionado) return;

    const toastId = toast.loading("Salvando...");

    try {
      const res = await fetch("/api/historico/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          historico_id: relatoSelecionado.id,
          classificacao,
          temperatura,
          pressao,
          frequencia,
          descricao_adicional: descricaoExtra,
          atualizado_por: enfermeiroId,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error("Erro ao atualizar triagem");

      await fetch("/api/historico/insert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ historico_id: relatoSelecionado.id, status: "finalizado" }),
      });

      setHistorico((prev) =>
        prev.map((h) =>
          h.id === relatoSelecionado.id
            ? {
                ...h,
                status: "finalizado",
                statusCheckin: "",
                classificacao,
                historicoAtualizacao: { temperatura, pressao, frequencia, descricao_adicional: descricaoExtra },
              }
            : h
        )
      );

      toast.dismiss(toastId);
      toast.success("Triagem atualizada com sucesso!");
      fecharModalEditar();
    } catch (err) {
      console.error(err);
      toast.dismiss(toastId);
      toast.error("Erro ao salvar triagem");
    }
  };

  const abrirModal = (relato: Relato) => {
    setRelatoSelecionado(relato);
    setModalAberto(true);
  };

  const abrirModalEditar = (relato: Relato) => {
    setRelatoSelecionado(relato);
    setClassificacao(relato.classificacao || "");
    setTemperatura(relato.historicoAtualizacao?.temperatura || "");
    setPressao(relato.historicoAtualizacao?.pressao || "");
    setFrequencia(relato.historicoAtualizacao?.frequencia || "");
    setDescricaoExtra(relato.historicoAtualizacao?.descricao_adicional || "");
    setModalEditar(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setRelatoSelecionado(null);
  };

  const fecharModalEditar = () => {
    setModalEditar(false);
    setRelatoSelecionado(null);
  };

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

  // ---------------------- QR CODE ----------------------
  useEffect(() => {
    if (!qrAberto) {
      codeReaderRef.current?.reset();
      codeReaderRef.current = null;
      return;
    }
    if (!videoRef.current) return;

    const codeReader = new BrowserQRCodeReader();
    codeReaderRef.current = codeReader;

    codeReader.decodeFromVideoDevice(
      null,
      videoRef.current,
      async (result, error) => {
        if (result) {
          const qrValue = result.getText();
          setQrResultado(qrValue);

          codeReader.reset();
          setQrAberto(false);

          try {
            const res = await fetch("/api/historico/checkin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ qrValue }),
            });
            const data = await res.json();

            if (data.message === "Check-in realizado" && data.historicoId) {
              setHistorico((prev) =>
                prev.map((h) =>
                  h.id === data.historicoId
                    ? { ...h, status: "checkin", statusCheckin: "checkin", checkinDataHora: data.checkinDataHora || new Date().toISOString() }
                    : h
                )
              );
            }

            if (data.message === "Check-in já realizado") {
              toast(`Este check-in já foi realizado.`, { icon: "⚠️" });
            } else if (data.message === "Check-in realizado") {
              toast.success(`Check-in realizado com sucesso!`);
            } else {
              toast.error(data.error || "Erro ao realizar check-in");
            }
          } catch (err) {
            console.error("Erro ao registrar check-in:", err);
            toast.error("Erro ao registrar check-in");
          }
        }

        if (error && error.name !== "NotFoundException" && error.name !== "ChecksumException") {
          console.error(error);
        }
      }
    );

    return () => {
      codeReader.reset();
    };
  }, [qrAberto]);
  // ------------------------------------------------------

  return (
    <main className={`${tema.mainBg} min-h-screen`}>
      <HeaderIn paginaAtiva="historico" tipoU="triagem" sessionServer={sessionServer} />
      <Toaster position="top-right" reverseOrder={false} />

      <div className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className={`text-2xl font-bold ${tema.textPrimary}`}>Histórico</h1>
          <BiQrScan
            size={28}
            className="cursor-pointer hover:text-gray-400 text-gray-500"
            onClick={() => setQrAberto(true)}
          />
        </div>

        <p className={`mt-2 text-sm ${tema.textSecondary}`}>
          Todos os relatos de sintomas e interações realizadas.
        </p>

        {/* Abas */}
        <div className="mt-4 flex gap-4 border-b border-gray-300 dark:border-gray-600">
          <button
            className={`pb-2 font-medium ${
              abaAtiva === "pendentes" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500 dark:text-gray-400"
            }`}
            onClick={() => setAbaAtiva("pendentes")}
          >
            Pendentes
          </button>
          <button
            className={`pb-2 font-medium ${
              abaAtiva === "confirmados" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500 dark:text-gray-400"
            }`}
            onClick={() => setAbaAtiva("confirmados")}
          >
            Confirmados
          </button>
        </div>

        {loading ? (
          <div className="mt-20 flex justify-center italic text-gray-500 text-sm">
            Carregando histórico...
          </div>
        ) : filtrarHistorico().length === 0 ? (
          <p className="mt-6 text-gray-500 dark:text-gray-300">Nenhum histórico encontrado.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-1 mt-6">
            {filtrarHistorico().map((h, idx) => {
              return (
                <div
                  key={`${h.id}-${idx}`}
                  className={`relative p-4 rounded-lg shadow-md border ${tema.borderColor} bg-white dark:bg-gray-800 hover:shadow-lg transition`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Nome completo do paciente */}
                      <p className="text-sm text-gray-800 dark:text-gray-200">{h.pacienteNome}</p>

                      {/* Descrição limitada */}
                      <h2 className={`text-sm font-semibold ${tema.textPrimary}`}>{limitarTexto(h.descricao, 30)}</h2>

                      {/* Data e tempo de espera */}
                      <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">{h.data}</p>
                      {h.dataISO && (
                        <p className="mt-1 inline-block border border-gray-400 dark:border-gray-600 dark:text-gray-300 rounded px-2 py-0.5 text-xs font-medium">
                          {calcTempoDecorrido(h.dataISO)}
                        </p>
                      )}

                      {h.status === "checkin" && h.checkinDataHora && (
                        <p className="text-xs text-green-600 mt-1">
                          Check-in em {new Date(h.checkinDataHora).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>

                    {/* Ações e status */}
                    <div className="flex flex-col items-end">
                      <div className="flex gap-2">
                        <FiEye
                          className="text-gray-500 hover:text-blue-500 cursor-pointer"
                          size={18}
                          onClick={() => {
                            abrirModal(h);
                            marcarComoVisto(h.id);
                          }}
                        />
                        {h.checkinDataHora && (
                          <FiEdit3
                            className="text-gray-500 hover:text-green-500 cursor-pointer"
                            size={18}
                            onClick={() => abrirModalEditar(h)}
                          />
                        )}
                      </div>

                      <span className="mt-2 inline-block px-2 py-0.5 text-xs rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium">
                        {h.status}
                      </span>

                      <span
                        className={`mt-1 inline-block px-2 py-0.5 text-xs rounded-md font-medium text-white ${getClassColor(
                          h.classificacao
                        )}`}
                      >
                        {h.classificacao || "Não classificado"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        )}
      </div>

      {/* Modal visualizar */}
      {modalAberto && relatoSelecionado && (
        <BottomSheetModal isOpen={modalAberto} onClose={fecharModal}>
          <div className="relative max-h-[70vh] overflow-y-auto p-6 space-y-6">
            <button
              onClick={fecharModal}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-600"
            >
              <FiX size={20} />
            </button>

            {/* Dados do paciente */}
            <div className="bg-gray-100 dark:bg-gray-200 p-4 rounded-md shadow-sm space-y-1 text-md">
              <h3 className="font-semibold text-gray-800 dark:text-gray-800 mb-2">Dados do Paciente</h3>
              <p>
                <strong>Nome:</strong> {relatoSelecionado.pacienteNome}
              </p>
              <p>
                <strong>Sexo:</strong> {relatoSelecionado.pacienteSexo}
              </p>
              <p>
                <strong>Idade:</strong> {relatoSelecionado.pacienteIdade} anos
              </p>
              <p>
                <strong>Número SUS:</strong> {relatoSelecionado.pacienteSUS}
              </p>
            </div>

            <h2 className="text-lg font-semibold text-gray-800">{relatoSelecionado.nome}</h2>
            <p className="mt-2 text-sm text-gray-600">{relatoSelecionado.descricao}</p>

            <div className="mt-4">
              <h3 className="font-semibold">Sintomas</h3>
              <ul className="list-disc ml-5 mt-2 text-sm">
                {relatoSelecionado?.sintomas?.length > 0 ? (
                  relatoSelecionado.sintomas.map((s: string, i: number) => <li key={i}>{s}</li>)
                ) : (
                  <li>Nenhum sintoma informado</li>
                )}
              </ul>
            </div>

            <div className="mt-4">
              <h3 className="font-semibold">Classificação</h3>
              <span
                className={`inline-block mt-1 px-3 py-1 rounded-md font-medium text-white ${getClassColor(
                  relatoSelecionado.classificacao
                )}`}
              >
                {relatoSelecionado.classificacao}
              </span>
            </div>

            {relatoSelecionado.status === "checkin" && relatoSelecionado.checkinDataHora && (
              <p className="mt-2 text-green-600 text-sm">
                Check-in em {new Date(relatoSelecionado.checkinDataHora).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        </BottomSheetModal>
      )}

      {/* Modal editar */}
      {modalEditar && relatoSelecionado && (
        <BottomSheetModal isOpen={modalEditar} onClose={fecharModalEditar}>
          <div className="relative max-h-[70vh] overflow-y-auto p-4">
            <button
              onClick={fecharModalEditar}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-600"
            >
              <FiX size={20} />
            </button>

            <h2 className="text-lg font-semibold text-gray-800">Atualizar Triagem</h2>

            <div className="mt-3">
              <label className="block text-sm font-medium">Classificação</label>
              <select
                value={classificacao}
                onChange={(e) => setClassificacao(e.target.value)}
                className="w-full mt-1 border rounded-md p-2 text-sm bg-white text-gray-800"
              >
                <option value="">Selecione</option>
                <option value="azul">Azul</option>
                <option value="verde">Verde</option>
                <option value="amarelo">Amarelo</option>
                <option value="laranja">Laranja</option>
                <option value="vermelho">Vermelho</option>
              </select>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Temperatura (°C)</label>
                <input
                  value={temperatura}
                  onChange={(e) => handleTemperatura(e.target.value)}
                  className="w-full mt-1 border rounded-md p-2 text-sm bg-white text-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">PA (mmHg)</label>
                <input
                  value={pressao}
                  onChange={(e) => handlePressao(e.target.value)}
                  placeholder="Ex: 120/80"
                  className="w-full mt-1 border rounded-md p-2 text-sm bg-white text-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Frequência Cardíaca</label>
                <input
                  value={frequencia}
                  onChange={(e) => handleFrequencia(e.target.value)}
                  className="w-full mt-1 border rounded-md p-2 text-sm bg-white text-gray-800"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium">Descrição Adicional</label>
              <textarea
                value={descricaoExtra}
                onChange={(e) => setDescricaoExtra(e.target.value)}
                className="w-full mt-1 border rounded-md p-2 text-sm bg-white text-gray-800"
                rows={3}
              />
            </div>

            <button
              onClick={salvarEdicao}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md font-semibold"
            >
              Salvar
            </button>
          </div>
        </BottomSheetModal>
      )}

      {/* Modal QR Code */}
      {qrAberto && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4">
          <div className="relative w-full max-w-lg h-96 flex items-center justify-center">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted
            />
            <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <mask id="qr-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect x="50%" y="50%" width="260" height="260" transform="translate(-130,-130)" fill="black" rx="4" />
              </mask>
              <rect width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#qr-mask)" />
            </svg>
            <div className="absolute top-1/2 left-1/2 w-64 h-64 -translate-x-1/2 -translate-y-1/2">
              <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-blue-500"></div>
              <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-blue-500"></div>
              <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-blue-500"></div>
              <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-blue-500"></div>
            </div>
            <p className="absolute bottom-4 w-full text-center text-white font-medium">
              Posicione o QR Code na área destacada
            </p>
          </div>
          <button
            onClick={() => setQrAberto(false)}
            className="mt-6 w-full max-w-lg sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-md shadow transition"
          >
            Fechar
          </button>
        </div>
      )}
    </main>
  );
}
