"use client";
 
import { useEffect, useRef, useState } from "react";
import { FiX, FiVideo, FiAlertTriangle, FiCheck } from "react-icons/fi";
import BottomSheetModal from "./BottomSheetModal";
import { useTheme } from "./ThemeProvider";
 
interface TermoTelemedinaModalProps {
  isOpen: boolean;
  pacienteId: string;
  onAceitar: () => void; // chamado após aceite registrado — prossegue para a fila
  onFechar: () => void;  // chamado ao cancelar
}
 
export default function TermoTelemedinaModal({
  isOpen,
  pacienteId,
  onAceitar,
  onFechar,
}: TermoTelemedinaModalProps) {
  const [leuTudo, setLeuTudo] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  const conteudoRef = useRef<HTMLDivElement>(null);
  const { tema } = useTheme();
 
  // Reseta estado toda vez que o modal abre
  useEffect(() => {
    if (isOpen) {
      setLeuTudo(false);
      setAceitando(false);
      // Scroll para o topo do conteúdo ao abrir
      setTimeout(() => {
        if (conteudoRef.current) conteudoRef.current.scrollTop = 0;
      }, 50);
    }
  }, [isOpen]);
 
  // Detecta se o usuário rolou até o final do texto
  const handleScroll = () => {
    const el = conteudoRef.current;
    if (!el) return;
    const chegouAoFinal = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
    if (chegouAoFinal) setLeuTudo(true);
  };
 
  const handleAceitar = async () => {
    if (!leuTudo || aceitando) return;
    setAceitando(true);
    try {
      await fetch("/api/termos-aceite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pacienteId, tipo: "telemedicina" }),
      });
      onAceitar();
    } catch (err) {
      console.error("Erro ao registrar aceite do termo:", err);
      // Mesmo com erro de registro, prossegue para não bloquear o paciente
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
      zIndex="z-[60000]"
    >
      <div className="flex flex-col w-full h-full min-h-[400px] overflow-hidden">
        {/* Cabeçalho Fixo (flex-shrink-0) */}
        <div className="w-full text-left animate-in fade-in slide-in-from-bottom-4 duration-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-2xl text-blue-600 dark:text-blue-400 shadow-sm">
                <FiVideo size={32} />
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${tema.textPrimary} tracking-tight`}>
                  Telemedicina
                </h2>
                <p className={`text-sm ${tema.textSecondary} font-medium`}>
                  Termo de Consentimento
                </p>
              </div>
            </div>
            <button 
              onClick={onFechar}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Fechar"
            >
              <FiX size={24} className="text-gray-500 hover:text-red-500 transition-colors" />
            </button>
          </div>
 
          {/* Aviso de leitura (Fixo acima do texto se não leu) */}
          {!leuTudo && (
            <div className="mb-4 flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 animate-pulse">
              <FiAlertTriangle className="text-amber-500 w-5 h-5 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                Role até o final do texto para habilitar o aceite.
              </p>
            </div>
          )}
        </div>
 
        {/* Área do Texto - Único local com scroll (flex-1 overflow-y-auto) */}
        <div
          ref={conteudoRef}
          onScroll={handleScroll}
          className="w-full flex-1 overflow-y-auto pr-2 mb-4 text-gray-700 dark:text-gray-300 space-y-4 leading-relaxed scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700"
        >
          <p>
            Prezado(a) paciente, este documento tem por finalidade fornecer informações sobre a modalidade de
            atendimento por <strong>telemedicina (teleconsulta)</strong> e obter seu consentimento livre e esclarecido
            para a realização do atendimento, em conformidade com o Código de Ética Médica, a Resolução CFM nº
            2.314/2022 e a Lei nº 13.989/2020.
          </p>
 
          <div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">1. O que é a Teleconsulta?</h4>
            <p>
              A teleconsulta é uma modalidade de consulta médica realizada de forma remota, por meio de plataforma
              digital segura, com conexão de áudio e/or vídeo em tempo real entre você (paciente) e o profissional de
              saúde. É uma alternativa de acesso ao cuidado à saúde, especialmente útil para casos de menor
              complexidade, orientações, acompanhamento e triagem.
            </p>
          </div>
 
          <div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
              2. Limitações da Teleconsulta — Não Substitui a Consulta Presencial
            </h4>
            <p>
              A teleconsulta <strong>não substitui a consulta presencial</strong>. Por sua natureza remota,{" "}
              <strong>não é possível realizar exame físico</strong> completo (ausculta, palpação, percussão, etc.),
              o que pode limitar a avaliação clínica em determinadas situações. Sendo assim:
            </p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>O médico poderá solicitar exames complementares ou encaminhar para atendimento presencial quando
                julgar necessário.</li>
              <li>Em situações de emergência ou urgência grave, você deve procurar imediatamente unidades de
                atendimento presencial (UPA, Pronto-Socorro ou SAMU 192).</li>
              <li>A emissão de prescrições médicas e atestados obedecerá à legislação vigente e ao julgamento
                clínico do médico.</li>
            </ul>
          </div>
 
          <div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">3. Privacidade e Proteção de Dados</h4>
            <p>
              Seus dados pessoais e de saúde são tratados com absoluto sigilo, em conformidade com a{" "}
              <strong>Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong>. As informações
              compartilhadas durante a teleconsulta são confidenciais e protegidas pelo sigilo médico. A sessão
              não é gravada sem seu consentimento explícito.
            </p>
          </div>
 
          <div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">4. Direitos do Paciente</h4>
            <ul className="list-disc ml-5 space-y-1">
              <li>Você tem o direito de recusar a teleconsulta a qualquer momento, sem prejuízo do seu
                atendimento.</li>
              <li>Você pode solicitar atendimento presencial se preferir ou se o médico indicar.</li>
              <li>Você tem direito a receber informações claras sobre diagnóstico, tratamento e prognóstico.</li>
            </ul>
          </div>
 
          <div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">5. Responsabilidades do Paciente</h4>
            <ul className="list-disc ml-5 space-y-1">
              <li>Fornecer informações verdadeiras e completas sobre seu estado de saúde.</li>
              <li>Estar em local reservado, com boa iluminação e conexão de internet estável.</li>
              <li>Não compartilhar o link ou acesso da consulta com terceiros.</li>
              <li>Informar ao médico se houver qualquer piora ou nova sintoma durante ou após a teleconsulta.</li>
            </ul>
          </div>
 
          <div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">6. Consentimento</h4>
            <p>
              Ao clicar em <strong>"Li e Concordo"</strong>, você declara que:
            </p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Leu e compreendeu todas as informações contidas neste termo.</li>
              <li>Recebeu esclarecimentos suficientes sobre essa modalidade de atendimento.</li>
              <li>Consente voluntariamente com a realização da teleconsulta.</li>
              <li>Compreende as limitações da telemedicina e que, quando necessário, precisará de atendimento
                presencial.</li>
            </ul>
          </div>
 
          <p className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
            Este termo tem validade permanente para futuras teleconsultas nesta plataforma. Sua aceitação fica
            registrada com data, hora e identificação do dispositivo utilizado.
          </p>
          
          {/* Espaço extra para scroll */}
          <div className="h-8" />
        </div>
 
        {/* Rodapé Fixo (flex-shrink-0) */}
        <div className="flex flex-col gap-3 w-full flex-shrink-0 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleAceitar}
            disabled={!leuTudo || aceitando}
            className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 relative overflow-hidden group ${
              leuTudo
                ? "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
                : "bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-600 cursor-not-allowed"
            }`}
          >
            {aceitando ? (
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {leuTudo && <span className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-500"></span>}
                {leuTudo ? "Li e Concordo — Entrar na Fila" : "Role para ler tudo"}
                <FiCheck className={leuTudo ? "opacity-100" : "opacity-30"} />
              </>
            )}
          </button>
          <button
            onClick={onFechar}
            className={`w-full py-3.5 rounded-2xl font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700`}
          >
            Agora não, prefiro local presencial
          </button>
        </div>
      </div>
    </BottomSheetModal>
  );
}
