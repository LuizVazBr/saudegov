"use client";

import { useEffect, useRef, useState } from "react";
import { FiX, FiActivity, FiAlertTriangle, FiCheck, FiCpu } from "react-icons/fi";
import BottomSheetModal from "./BottomSheetModal";
import { useTheme } from "./ThemeProvider";
import { safeStorage } from "@/lib/storage";

interface TermoTriageModalProps {
  isOpen: boolean;
  pacienteId: string;
  onAceitar: () => void; 
  onFechar: () => void;  
}

export default function TermoTriageModal({
  isOpen,
  pacienteId,
  onAceitar,
  onFechar,
}: TermoTriageModalProps) {
  const [leuTudo, setLeuTudo] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  const conteudoRef = useRef<HTMLDivElement>(null);
  const { tema } = useTheme();

  useEffect(() => {
    if (isOpen) {
      setLeuTudo(false);
      setAceitando(false);
      setTimeout(() => {
        if (conteudoRef.current) conteudoRef.current.scrollTop = 0;
      }, 50);
    }
  }, [isOpen]);

  const handleScroll = () => {
    const el = conteudoRef.current;
    if (!el) return;
    const chegouAoFinal = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
    if (chegouAoFinal) setLeuTudo(true);
  };

  const handleAceitar = async () => {
    if (!leuTudo || aceitando) return;
    setAceitando(true);
    
    try {
        await fetch("/api/termos-aceite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pacienteId, tipo: "triage_ai" }),
        });
        
        // Persistência local também para evitar calls desnecessários na mesma aba
        safeStorage.setItem("termo_triage_aceito", "true");
        onAceitar();
    } catch (err) {
        console.error("Erro ao registrar aceite do termo:", err);
        // Prossegue mesmo com erro para não bloquear o atendimento crítico
        onAceitar();
    } finally {
        setAceitando(false);
    }
  };

  return (
    <BottomSheetModal 
      isOpen={isOpen} 
      onClose={onFechar} 
      disableBackdropClick={true}
      maxHeight="80vh"
      zIndex="z-[70000]"
    >
      <div className="flex flex-col w-full h-full min-h-[400px] overflow-hidden p-1">
        {/* Cabeçalho Fixo */}
        <div className="w-full text-left flex-shrink-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-100 dark:bg-emerald-900/40 p-3 rounded-2xl text-emerald-600 dark:text-emerald-400 shadow-sm">
                <FiCpu size={32} />
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${tema.textPrimary} tracking-tight`}>
                  Triagem por IA
                </h2>
                <p className={`text-sm ${tema.textSecondary} font-medium`}>
                  Termos e Responsabilidades
                </p>
              </div>
            </div>
            <button 
              onClick={onFechar}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <FiX size={24} className="text-gray-500 hover:text-red-500 transition-colors" />
            </button>
          </div>

          {!leuTudo && (
            <div className="mb-4 flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 animate-pulse">
              <FiAlertTriangle className="text-blue-500 w-5 h-5 flex-shrink-0" />
              <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                Role até o final para confirmar que compreende as limitações.
              </p>
            </div>
          )}
        </div>

        {/* Área do Texto */}
        <div
          ref={conteudoRef}
          onScroll={handleScroll}
          className="w-full flex-1 overflow-y-auto pr-2 mb-4 text-gray-700 dark:text-gray-300 space-y-4 leading-relaxed scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700"
        >
          <p className="font-medium text-gray-900 dark:text-gray-100 italic">
            Ao utilizar esta ferramenta de triagem baseada em Inteligência Artificial, você reconhece e aceita os seguintes termos:
          </p>

          <div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">1. Natureza Informativa e não Diagnóstica</h4>
            <p>
              A triagem realizada pela IA (Anamnex) é uma ferramenta de apoio e orientação baseada nos protocolos de Manchester. 
              <strong> Ela não constitui um diagnóstico médico definitivo</strong> nem substitui a avaliação clínica presencial por um profissional de saúde.
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800/50">
            <h4 className="font-bold text-red-700 dark:text-red-400 mb-1 flex items-center gap-2">
              <FiAlertTriangle /> Aviso de Triagem Inconsistente
            </h4>
            <p className="text-sm text-red-800 dark:text-red-300 font-medium">
              Em casos de <strong>dor aguda, febre alta ou sintomas severos</strong>, a IA pode fornecer uma classificação de baixo risco (Azul/Verde) devido a limitações de processamento ou falta de exames clínicos. 
              <strong> Se você sente que sua condição é grave, não aguarde: procure atendimento presencial imediato em uma UPA ou Hospital, independentemente da classificação gerada aqui.</strong>
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">2. Responsabilidade pelas Informações</h4>
            <p>
              A precisão da triagem depende inteiramente das informações fornecidas por você. Sintomas omitidos ou descritos incorretamente podem levar a uma classificação de risco inadequada.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">3. Limitações Tecnológicas</h4>
            <p>
              Como qualquer sistema computacional, a IA está sujeita a interpretações errôneas de linguagem coloquial ou gírias. Use termos claros para descrever o que está sentindo.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">4. Emergências Médicas</h4>
            <p>
              Se você estiver apresentando falta de ar grave, dor no peito, perda de consciência, sangramento incontrolável ou sinais de AVC, <strong>LIGUE PARA O SAMU (192) IMEDIATAMENTE</strong> e não utilize este sistema.
            </p>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
            Ao clicar em "Compreendo e desejo prosseguir", você isenta a plataforma de responsabilidade por decisões tomadas exclusivamente com base nesta triagem automatizada, reconhecendo que deve sempre buscar orientação médica humana.
          </p>
          
          <div className="h-8" />
        </div>

        {/* Rodapé Fixo */}
        <div className="flex flex-col gap-3 w-full flex-shrink-0 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleAceitar}
            disabled={!leuTudo || aceitando}
            className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 relative overflow-hidden group ${
              leuTudo
                ? "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]"
                : "bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-600 cursor-not-allowed"
            }`}
          >
            {aceitando ? (
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {leuTudo ? "Compreendo e desejo prosseguir" : "Role para ler o aviso"}
                {leuTudo && <FiCheck className="opacity-100" />}
              </>
            )}
          </button>
          <button
            onClick={onFechar}
            className={`w-full py-3.5 rounded-2xl font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700`}
          >
            Voltar
          </button>
        </div>
      </div>
    </BottomSheetModal>
  );
}
