"use client";

import { useState } from "react";
import { FiUser, FiMenu, FiVolume2, FiVolumeX, FiBell } from "react-icons/fi";
import { useTheme } from "./ThemeProvider";
import { useAudioPlayer } from "./AudioPlayer";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Session } from "next-auth";

interface HeaderInProps {
  paginaAtiva: string; // ex: "condicoes", "perfil", "historico"
  tipoU: string;        // tipo de usuário: "triagem", "gestor", "paciente", etc.
  sessionServer?: Session | null;
}

export default function HeaderIn({ paginaAtiva, tipoU, sessionServer }: HeaderInProps) {
  const { tema, themeName, toggleTheme } = useTheme();
  const { audioHabilitado, toggleAudio } = useAudioPlayer(tema);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  if (status === "loading" && !sessionServer) {
    return <div>Carregando...</div>;
  }

  // Prioriza sessionServer, mas cai para o session do hook se o primeiro for nulo (comum em páginas CSR)
  const currentSession = sessionServer || session;

  const tipoUsuarioRaw = currentSession?.user?.tipo_usuario?.toLowerCase() || "paciente";
  const tipoUsuario = tipoUsuarioRaw.charAt(0).toUpperCase() + tipoUsuarioRaw.slice(1);

  const isMedico = tipoUsuarioRaw === "medico" || tipoU === "medico" || tipoU === "triagem";

  let nomeUsuario = isMedico ? "Médico(a)" : "Usuário";

  if (currentSession?.user?.name) {
    const nomeCompleto = currentSession.user.name.trim();
    const nomeLower = nomeCompleto.toLowerCase();

    // Se o nome registrado no banco for genérico ou contiver "paciente", substitui
    const ehNomeGenerico =
      nomeLower === "usuario paciente" ||
      nomeLower.startsWith("usuario") ||
      nomeLower.includes("paciente");

    if (ehNomeGenerico && isMedico) {
      nomeUsuario = "Médico(a)";
    } else if (!ehNomeGenerico) {
      nomeUsuario = nomeCompleto.split(" ")[0];
    }
  }

  // Define itens do menu com base no tipo de usuário
  const menuItems = (tipoU === "triagem")
    ? [
      { label: "Sair", page: "sair", onClick: async () => {
        await signOut({ redirect: false });
        window.location.href = "/login?cleared=true";
      } },
    ]
    : [
      { label: "Inicial", page: "inicial", onClick: () => router.push("/") },
      ...(tipoU === "gestor" || tipoUsuarioRaw === "gestor" ? [{ label: "Dashboard", page: "dashboard", onClick: () => router.push("/dashboard") }] : []),
      { label: "Meu perfil", page: "perfil", onClick: () => router.push("/perfil") },
      { label: "Configurações", page: "configuracoes", onClick: () => router.push("/configuracoes") },
      { label: "Condições", page: "condicoes", onClick: () => router.push("/condicoes") },
      { label: "Meus tratamentos", page: "tratamentos", onClick: () => router.push("/tratamentos") },
      { label: "Meus exames", page: "exames", onClick: () => router.push("/exames") },
      { label: "Meus agendamentos", page: "agendamentos", onClick: () => router.push("/agendamentos") },
      { label: "Histórico", page: "historico", onClick: () => router.push("/historico") },
      { label: "Sair", page: "sair", onClick: async () => {
        await signOut({ redirect: false });
        window.location.href = "/login?cleared=true";
      } },
    ];

  return (
    <div className={`flex items-center justify-between px-4 py-3 border-b ${tema.borderColor} bg-white dark:bg-gray-800`}>
      {/* Perfil usuário */}
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tema.badgeBg} ${tema.badgeText}`}>
          <FiUser size={20} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className={`text-sm font-bold ${tema.textPrimary}`}>Olá, {nomeUsuario}</span>
          <span className={`text-xs cursor-pointer font-bold ${tema.textPrimary} hover:underline`}>{tipoUsuario}</span>
        </div>
      </div>

      {/* Botões direita */}
      <div className="flex items-center space-x-3 relative">

        {/* Ícone de Notificações */}
        {/*<button
          onClick={() => router.push("/noticias")}
          className="relative p-0 rounded-full flex items-center justify-center transition"
          title="Notificações"
        >
          <FiBell size={20} className="dark:text-gray-200" />

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

        {/* Menu hambúrguer sempre visível, mas itens dependem do tipo */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-full cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          <FiMenu size={22} className="dark:text-gray-200" />
        </button>

        {menuOpen && (
          <div className={`absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 shadow-lg rounded-md border ${tema.borderColor} z-50`}>
            {menuItems.map((item, idx) => {
              const isActive = item.page === paginaAtiva;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (!isActive) item.onClick();
                    setMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 transition ${isActive
                    ? `bg-gray-200 dark:bg-gray-700 font-semibold ${tema.textPrimary}`
                    : `hover:bg-gray-100 dark:hover:bg-gray-700 ${tema.textPrimary}`
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
  );
}
