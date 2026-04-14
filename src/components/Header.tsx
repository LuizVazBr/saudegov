"use client";

import { useState, useEffect } from "react";
import { FiMenu, FiUser, FiPause, FiPlay, FiMic, FiPhone, FiVolume2, FiVolumeX, FiBell, FiActivity, FiHeart, FiVideo, FiSearch } from "react-icons/fi";
import { MdKeyboard, MdFavorite } from "react-icons/md";
import { useTheme } from "./ThemeProvider";
import Shortcuts from "./Shortcuts";
import ReceberLigacaoModal from "./ReceberLigacaoModal";
import { useAudioPlayer } from "./AudioPlayer";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Session } from "next-auth";

interface HeaderProps {
  handleClickFalarSintomas: () => void;
  setModalAberto: (open: boolean) => void;
  setModalLigacaoAberto: (open: boolean) => void;
  modalLigacaoAberto: boolean;
  handleReceberLigacao: () => void;
  sessionServer?: Session;
  activeCall?: { roomName?: string; status: string; tempoEstimado?: number; posicao?: number } | null;
}

export default function Header({
  handleClickFalarSintomas,
  setModalAberto,
  setModalLigacaoAberto,
  modalLigacaoAberto,
  handleReceberLigacao,
  sessionServer,
  activeCall,
}: HeaderProps) {
  const { tema, themeName, toggleTheme } = useTheme();
  const { audioHabilitado, toggleAudio, isPlaying, togglePlay, tocarAudioLigacao } = useAudioPlayer(tema);
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const handleClickAutoexame = () => {
    router.push("/autoexame");
  };

  const [menuOpen, setMenuOpen] = useState(false);

  // Carregar último resultado do Hetrack (Cardiac Test)
  const [lastCardiac, setLastCardiac] = useState<any>(null);

  useEffect(() => {
    const history = localStorage.getItem("hetrack_history");
    if (history) {
      try {
        const parsed = JSON.parse(history);
        if (parsed.length > 0) {
          setLastCardiac(parsed[0].result);
        }
      } catch (e) {
        console.error("Erro ao carregar histórico cardíaco:", e);
      }
    }
  }, []);

  const getCardiacColor = (batimento: string) => {
    if (!batimento) return "text-gray-500";
    if (batimento.toLowerCase().includes("normal")) return "text-green-500";
    return "text-red-500";
  };

  if (status === "loading") {
    return <div>Carregando...</div>;
  }


  // Prioriza sessionServer, mas cai para o session do hook se o primeiro for nulo (comum em páginas CSR)
  const currentSession = sessionServer || session;

  const nomeUsuario = currentSession?.user?.name
    ? currentSession.user.name.split(" ")[0]
    : "Usuário";

  const tipoUsuarioRaw = currentSession?.user?.tipo_usuario || "paciente";
  const tipoUsuario = tipoUsuarioRaw.charAt(0).toUpperCase() + tipoUsuarioRaw.slice(1);


  const menuItems = [
    { label: "Meu perfil", page: "perfil", onClick: () => router.push("/perfil") },
    { label: "Configurações", page: "configuracoes", onClick: () => router.push("/configuracoes") },
    { label: "Condições", page: "condicoes", onClick: () => router.push("/condicoes") },
    { label: "Meus tratamentos", page: "tratamentos", onClick: () => router.push("/tratamentos") },
    { label: "Meus exames", page: "exames", onClick: () => router.push("/exames") },
    { label: "Meus agendamentos", page: "agendamentos", onClick: () => router.push("/agendamentos") },
    { label: "Histórico", page: "historico", onClick: () => router.push("/historico") },
    ...(tipoUsuarioRaw !== "paciente" ? [{ 
      label: "Explorador clínico", 
      page: "arvore", 
      onClick: () => router.push("/paciente/arvore") 
    }] : []),
    { label: "Endpoints SaudeGov", page: "endpoints", onClick: () => router.push("/endpoints") },
    ...(tipoUsuarioRaw === "gestor" ? [{ 
      label: "Chaves de API", 
      page: "api-keys", 
      onClick: () => router.push("/gestor/api-keys") 
    }] : []),
    {
      label: "Sair", page: "sair", onClick: async () => {
        await signOut({ redirect: false });
        // Hard navigation para furar cache agressivo do navegador/Nginx no mobile
        window.location.href = "/login?cleared=true";
      }
    },
  ];

  return (
    <>
      {/* Cabeçalho superior */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${tema.borderColor} ${tema.cardBg}`}>
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tema.badgeBg} ${tema.badgeText}`}>
            <FiUser size={20} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className={`text-sm font-bold ${tema.textPrimary}`}>Olá, {nomeUsuario}</span>
            <span className={`text-xs cursor-pointer font-bold ${tema.textPrimary} hover:underline`}>{tipoUsuario}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3 relative">

          {/* Ícone de Notificações */}
          {/*<button
            onClick={() => router.push("/noticias")}
            className="relative p-0 rounded-full flex items-center justify-center transition"
            title="Notificações"
          >
            <FiBell size={20} className="dark:text-gray-200" />

            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              1
            </span>
          </button>*/}

          {/* Botão áudio */}
          <button
            onClick={toggleAudio}
            className="p-0 rounded-full flex items-center justify-center transition"
            title={audioHabilitado ? "Áudio habilitado" : "Áudio desabilitado"}
          >
            {audioHabilitado ? <FiVolume2 size={20} className="dark:text-gray-200" /> : <FiVolumeX size={20} className="dark:text-gray-200" />}
          </button>

          {/* Botão tema */}
          <button
            onClick={toggleTheme}
            className="p-0 rounded-full flex items-center justify-center transition"
            title={themeName === "dark" ? "Modo escuro" : "Modo claro"}
          >
            {themeName === "dark" ? (
              <div className="w-5 h-5 rounded-full border-2 border-gray-400" />
            ) : (
              <div className="w-5 h-5 bg-gray-700 border-2 border-gray-700 rounded-full" />
            )}
          </button>

          {/* Menu Hambúrguer */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-full cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition">
            <FiMenu size={22} className="dark:text-gray-200" />
          </button>
          {menuOpen && (
            <div className={`absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 shadow-lg rounded-md border ${tema.borderColor} z-50`}>
              {menuItems.map((item, idx) => {
                const isActive = item.label === "Pré-triagem"; // ajuste conforme a página atual
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (!isActive) item.onClick();
                      setMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 transition rounded ${isActive
                      ? `bg-gray-200 dark:bg-gray-700 font-semibold ${themeName === "dark" ? "text-gray-200" : "text-gray-900"}`
                      : `hover:bg-gray-100 dark:hover:bg-gray-700 ${themeName === "dark" ? "text-gray-200" : "text-gray-900"}`
                      }`}
                    disabled={isActive}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* Atalhos */}
      {/*<Shortcuts tema={tema} />*/}

      {/* Seção Pré-triagem */}
      <div className={`px-5 py-4 ${tema.cardBg}`}>
        {/* NOVO: Card de Resumo Cardíaco (Acima de Pré-triagem) */}
        {lastCardiac && (
          <div
            onClick={() => router.push('/hetrack')}
            className={`mb-6 p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <FiHeart className="text-red-500" size={24} />
              </div>
              <div>
                <h3 className={`text-xs font-medium ${tema.textSecondary}`}>Último teste cardíaco</h3>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${tema.textPrimary}`}>
                    {lastCardiac.heart_rate_bpm || "--"} <span className="text-xs font-normal opacity-70">BPM</span>
                  </span>
                  <span className={`text-xs font-bold ${getCardiacColor(lastCardiac.batimento || lastCardiac.status_message)}`}>
                    • {lastCardiac.batimento || (lastCardiac.status_message?.includes("normal") ? "Normal" : "Com alterações")}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-gray-400">
              <span className="text-lg">→</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-0">
          <h1 className={`text-2xl font-semibold leading-loose ${tema.textPrimary}`}>Pré-triagem</h1>
          <button
            onClick={togglePlay}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            title={isPlaying ? "Parar música" : "Tocar música"}
          >
            {isPlaying ? <FiPause size={22} className="text-red-500" /> : <FiPlay size={22} className="text-green-600" />}
          </button>
        </div>

        <p className={`text-md leading-relaxed mt-0 ${tema.textSecondary}`}>
          Realize sua pré-triagem agora mesmo, informe seus sintomas com antecedência e seja direcionado rapidamente para o atendimento.
        </p>

        <div className="mt-8">
          {activeCall && (
            <>
              {tipoUsuario.toLowerCase() !== "medico" ? (
                <>
                  {activeCall.status === "aguardando" && (
                    <div className="mb-6 bg-blue-50 dark:bg-blue-900/40 border-l-4 border-blue-400 p-4 rounded-r-lg shadow-sm flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-blue-800 dark:text-blue-200">Você está na fila de telemedicina</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-400">
                          Posição: {activeCall.posicao}º {activeCall.tempoEstimado ? `(~${activeCall.tempoEstimado} min)` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const pid = sessionStorage.getItem("pacienteId");
                          if (pid) sessionStorage.setItem("pacienteIdFila", pid);
                          window.location.href = '/fila-telemedicina';
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition whitespace-nowrap ml-2"
                      >
                        Ver Fila
                      </button>
                    </div>
                  )}

                  {activeCall.status === "chamado" && (
                    <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/40 border-l-4 border-yellow-500 p-4 rounded-r-lg shadow-sm flex items-center justify-between animate-pulse">
                      <div>
                        <h3 className="font-bold text-yellow-800 dark:text-yellow-200">O profissional está se preparando</h3>
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">Aguarde o profissional terminar de organizar a sala.</p>
                      </div>
                      <button
                        onClick={() => {
                          const pid = sessionStorage.getItem("pacienteId");
                          if (pid) sessionStorage.setItem("pacienteIdFila", pid);
                          if (typeof window !== "undefined") {
                            window.location.href = `/fila-telemedicina`;
                          }
                        }}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold text-sm transition whitespace-nowrap ml-2 shadow-md"
                      >
                        Retornar
                      </button>
                    </div>
                  )}

                  {activeCall.status === "em_atendimento" && (
                    <div className="mb-6 bg-green-50 dark:bg-green-900/40 border-l-4 border-green-500 p-4 rounded-r-lg shadow-sm flex items-center justify-between animate-pulse">
                      <div>
                        <h3 className="font-bold text-green-800 dark:text-green-200">Consulta em andamento</h3>
                        <p className="text-sm text-green-700 dark:text-green-400">O médico está aguardando você na sala de vídeo.</p>
                      </div>
                      <button
                        onClick={() => {
                          const pid = sessionStorage.getItem("pacienteId");
                          if (pid) sessionStorage.setItem("pacienteIdFila", pid);
                          const cleanRoom = activeCall.roomName?.replace('-online', '');
                          if (typeof window !== "undefined") {
                            window.location.href = `/teleconsulta/sala?room=${cleanRoom}`;
                          }
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm transition whitespace-nowrap ml-2 shadow-md"
                      >
                        Retornar à sala
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {(activeCall.status === "chamado" || activeCall.status === "em_atendimento") && (
                    <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/40 border-l-4 border-yellow-500 p-4 rounded-r-lg shadow-sm flex items-center justify-between animate-pulse">
                      <div>
                        <h3 className="font-bold text-yellow-800 dark:text-yellow-200">Você tem uma consulta ativa</h3>
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">Clique para retornar para a sala de vídeo.</p>
                      </div>
                      <button
                        onClick={() => {
                          const cleanRoom = activeCall.roomName?.replace('-online', '');
                          const docName = sessionServer?.user?.name ? sessionServer.user.name : "Médico";
                          if (typeof window !== "undefined") {
                            window.location.href = `/teleconsulta/sala?room=${cleanRoom}&nome=${encodeURIComponent(docName)}&medico=true`;
                          }
                        }}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold text-sm transition whitespace-nowrap ml-2 shadow-md"
                      >
                        Retornar à sala
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {(tipoUsuario.toLowerCase() === "medico" || tipoUsuario.toLowerCase() === "enfermeiro" || tipoUsuario.toLowerCase() === "gestor") && (
            <div className="space-y-4 mb-6">
              {tipoUsuario.toLowerCase() === "medico" && (
                <button
                  type="button"
                  onClick={() => router.push('/medico/fila')}
                  className={`w-full rounded-lg border-[3px] border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 flex items-center justify-center space-x-2 px-6 py-4 font-bold transition hover:bg-blue-100 dark:hover:bg-blue-900/40`}
                >
                  <FiActivity size={20} />
                  <span>Gestão de fila</span>
                </button>
              )}

              {tipoUsuario.toLowerCase() === "gestor" && (
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className={`w-full rounded-lg border-[3px] border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 flex items-center justify-center space-x-2 px-6 py-4 font-bold transition hover:bg-blue-100 dark:hover:bg-blue-900/40`}
                >
                  <FiActivity size={20} />
                  <span>Painel do gestor</span>
                </button>
              )}

              {tipoUsuario.toLowerCase() === "gestor" && (
                <button
                  type="button"
                  onClick={() => router.push('/gestor/dashboard')}
                  className={`w-full rounded-lg border-[3px] border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 flex items-center justify-center space-x-2 px-6 py-4 font-bold transition hover:bg-red-100 dark:hover:bg-red-900/40`}
                >
                  <FiActivity size={20} />
                  <span>Monitoramento</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => router.push('/paciente/arvore')}
                className={`w-full rounded-lg border-[3px] border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center space-x-2 px-6 py-4 font-bold transition hover:bg-emerald-100 dark:hover:bg-emerald-900/40`}
              >
                <FiSearch size={20} />
                <span>Explorador clínico</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0 mt-6">
          <button
            type="button"
            onClick={handleClickFalarSintomas}
            className={`flex-1 rounded-lg border-[3px] border-gray-400 bg-transparent flex items-center justify-center space-x-2 px-6 py-4 font-medium transition ${tema.textPrimary} hover:bg-gray-300 dark:hover:bg-gray-600`}
          >
            <FiMic size={20} />
            <span>Falar sintomas</span>
          </button>

          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className={`flex-1 rounded-lg border-[3px] border-gray-400 bg-transparent flex items-center justify-center space-x-2 px-6 py-4 font-medium transition ${tema.textPrimary} hover:bg-gray-300 dark:hover:bg-gray-600`}
          >
            <MdKeyboard size={20} />
            <span>Digitar sintomas</span>
          </button>

          <button
            type="button"
            onClick={handleClickAutoexame}
            className={`rounded-lg border-[3px] border-gray-400 bg-transparent flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium transition ${tema.textPrimary} hover:bg-gray-300 dark:hover:bg-gray-600`}
          >
            <FiUser size={16} />
            <span>Autoexame</span>
          </button>
        </div>

        {/*<div className="mt-6">
          <button
            type="button"
            onClick={() => {
              setModalLigacaoAberto(true);
              tocarAudioLigacao();
            }}
            className={`w-full flex items-center justify-center space-x-2 px-6 py-2 font-medium rounded-lg transition text-white ${tema.btnBg} ${tema.btnHover}`}
          >
            <FiPhone size={20} />
            <span>Receber ligação</span>
          </button>
        </div>

        <ReceberLigacaoModal
          isOpen={modalLigacaoAberto}
          onClose={() => setModalLigacaoAberto(false)}
          numero="+55 61 4040-4822"
          tema={tema}
          onReceberLigacao={handleReceberLigacao}
        />*/}
      </div>
    </>
  );
}
