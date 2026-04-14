"use client";

import { FiTrash, FiMapPin, FiAlertTriangle, FiX } from "react-icons/fi";
import { useState } from "react";
import { BsQrCode } from "react-icons/bs";
import toast from "react-hot-toast"; // 🔹 toast import

interface Unidade {
  nome: string;
  endereco: string;
  lat: number;
  lng: number;
}

interface HistoricoItem {
  id?: string;
  texto: string;
  dataHora: string;
  classificacao: string;
  status?: string;
  expira?: string;
  origem?: string;
  qrToken?: string;
  relatoId?: string;
  sintomas?: string[];
}

interface HistoricoProps {
  historico: HistoricoItem[];
  loading: boolean;
  userLocation: [number, number] | null;
  ubs: Unidade[];
  upa: Unidade[];
  setSintomas: (texto: string) => void;
  setModalAberto: (open: boolean) => void;
  setHistorico: React.Dispatch<React.SetStateAction<HistoricoItem[]>>;
  setUnidadeSelecionada: (unidade: Unidade | null) => void;
  abrirModalEndereco: () => void;
  abrirModalQr: (texto: string) => void;
  abrirModalResultado: (item: HistoricoItem) => void;
  tema: any;
  getClassificacaoColor: (classificacao: string) => string; // 🔹 função agora vem de props
}

export default function Historico({
  historico,
  loading,
  userLocation,
  ubs,
  upa,
  setSintomas,
  setModalAberto,
  setHistorico,
  setUnidadeSelecionada,
  abrirModalEndereco,
  abrirModalQr,
  abrirModalResultado,
  tema,
  getClassificacaoColor
}: HistoricoProps) {
  const [itemParaExcluir, setItemParaExcluir] = useState<HistoricoItem | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const historicoUnico = historico.filter(
    (item, index, self) =>
      index === self.findIndex(
        h =>
          h.texto === item.texto &&
          h.dataHora === item.dataHora &&
          h.classificacao === item.classificacao
      )
  );

  const handleConfirmarExclusao = async () => {
    if (!itemParaExcluir || !itemParaExcluir.id) return;

    setExcluindo(true);
    try {
      const res = await fetch(`/api/remover-historico/${itemParaExcluir.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setHistorico(h => h.filter(hh => hh.id !== itemParaExcluir.id));
        toast.success("Histórico removido com sucesso!");
        setItemParaExcluir(null);
      } else {
        toast.error("Erro ao excluir histórico.");
      }
    } catch (err) {
      console.error("Erro ao excluir:", err);
      toast.error("Erro ao excluir histórico.");
    } finally {
      setExcluindo(false);
    }
  };

  const handleDelete = (item: HistoricoItem) => {
    if (!item.id) {
      toast.error("Não é possível excluir este item sem ID.");
      return;
    }
    setItemParaExcluir(item);
  };

  // Helper code to get closest location
  const getUnidadeMaisProxima = (escolhaItem: HistoricoItem) => {
    let lista: Unidade[] = [];
    const cls = escolhaItem.classificacao.toLowerCase().trim();
    if (cls === "azul" || cls === "verde") lista = ubs;
    else if (["amarelo", "laranja", "vermelho"].includes(cls)) lista = upa;

    if (lista.length === 0) return null;

    let unidadeMaisProxima = lista[0];
    if (userLocation) {
        const distancia = (a: [number, number], b: [number, number]) => {
            const dx = a[0] - b[0];
            const dy = a[1] - b[1];
            return Math.sqrt(dx * dx + dy * dy);
        };
        unidadeMaisProxima = lista.reduce((prev, curr) => {
            const distPrev = distancia([prev.lat, prev.lng], userLocation);
            const distCurr = distancia([curr.lat, curr.lng], userLocation);
            return distCurr < distPrev ? curr : prev;
        }, lista[0]);
    }
    return unidadeMaisProxima;
  };

  return (
    <div className={`px-5 py-5 text-md leading-loose ${tema.textPrimary}`}>
      {loading ? (
        <div className="flex items-center space-x-2 text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Carregando histórico...</span>
        </div>
      ) : historicoUnico.length === 0 ? (
        "Nenhum histórico disponível."
      ) : (
        <ul className="space-y-3">
          {historicoUnico.map((item, index) => {
            const textoLimitado =
              item.texto.length > 20 ? item.texto.slice(0, 20) + "..." : item.texto;
            const key = item.id ?? index;

            return (
              <li key={key} className="border-b pb-2 cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5 rounded-md p-2" onClick={() => {
                  const unidade = getUnidadeMaisProxima(item);
                  setUnidadeSelecionada(unidade);
                  abrirModalResultado(item);
              }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <div
                      className={`w-5 h-5 rounded-full ${getClassificacaoColor(item.classificacao)}`}
                      title={`Classificação: ${item.classificacao}`}
                    />
                    <div className="flex flex-col">
                      <span className="truncate" title={item.texto}>{textoLimitado}</span>
                      <span className="text-xs text-gray-500">{item.dataHora}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-1">
                    <div className="flex items-center space-x-2">
                      {item.status === "iniciado" && (
                        <button
                          className="p-1 hover:text-red-500"
                          title="Excluir"
                          onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                        >
                          <FiTrash size={16} />
                        </button>
                      )}

                      <button
                        className="p-1 hover:text-green-600"
                        title="Mostrar endereço"
                        onClick={(e) => {
                          e.stopPropagation();
                          const unidade = getUnidadeMaisProxima(item);
                          if (!unidade) {
                            toast.error("Localização não disponível para esta unidade");
                            return;
                          }
                          setUnidadeSelecionada(unidade);
                          abrirModalEndereco();
                        }}
                      >
                        <FiMapPin size={18} />
                      </button>

                      <button
                        className="p-1 hover:text-purple-600"
                        title="Mostrar QR Code"
                        onClick={(e) => { e.stopPropagation(); abrirModalQr(item.id || ""); }}
                      >
                        <BsQrCode size={18} />
                      </button>
                    </div>

                    <span className="bg-gray-100 text-black text-xs px-3 py-1 rounded-full">
                      {item.status}
                    </span>
                  </div>
                </div>

                {item.expira && (
                  <div className="mt-2 ml-5 rounded px-3 py-1 text-sm font-semibold text-gray-600 dark:text-gray-600">
                    {item.expira}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO PERSONALIZADO */}
      {itemParaExcluir && (
        <div className="fixed inset-0 z-[60000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden transform animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/40 rounded-full mb-4">
                <FiAlertTriangle className="text-red-600 dark:text-red-400" size={24} />
              </div>
              
              <h3 className="text-center text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                Excluir Histórico?
              </h3>
              
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">
                Esta ação não pode ser desfeita. O registro será removido permanentemente.
              </p>

              <div className="flex flex-col gap-2">
                <button
                  disabled={excluindo}
                  onClick={handleConfirmarExclusao}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {excluindo ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <FiTrash size={18} />}
                  {excluindo ? "Excluindo..." : "Confirmar Exclusão"}
                </button>
                
                <button
                  disabled={excluindo}
                  onClick={() => setItemParaExcluir(null)}
                  className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-3 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FiX size={18} />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
