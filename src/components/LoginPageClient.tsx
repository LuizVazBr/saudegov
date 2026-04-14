"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { FiUser, FiEye, FiEyeOff, FiSun, FiMoon, FiLock, FiX, FiArrowLeft, FiVolume2, FiVolumeX } from "react-icons/fi";
import toast, { Toaster } from "react-hot-toast";
import BottomSheetModal from "@/components/BottomSheetModal";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { useAudioPlayer } from "@/components/AudioPlayer";
import { safeStorage } from "@/lib/storage";

export default function LoginPageClient() {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"cpf" | "senha">("cpf");
  const [isTermosOpen, setIsTermosOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const cpfRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);

  const { tema, themeName, toggleTheme } = useTheme();

  const { audioHabilitado, toggleAudio, isPlaying, togglePlay } = useAudioPlayer(tema);

  useEffect(() => {
    if (isTermosOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [isTermosOpen]);

  const formatCpf = (value: string) => {
    const cpfNum = value.replace(/\D/g, "").slice(0, 11);
    return cpfNum
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const validarCpf = (cpf: string) => {
    const num = cpf.replace(/\D/g, "");
    if (num.length !== 11 || /^(\d)\1{10}$/.test(num)) return false;

    const calcDigito = (pos: number) => {
      let soma = 0;
      for (let i = 0; i < pos; i++) {
        soma += parseInt(num.charAt(i)) * (pos + 1 - i);
      }
      const resto = (soma * 10) % 11;
      return resto === 10 ? 0 : resto;
    };

    return calcDigito(9) === parseInt(num.charAt(9)) &&
      calcDigito(10) === parseInt(num.charAt(10));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step === "cpf") {
      if (!validarCpf(cpf)) {
        toast.error("CPF inválido", {
          style: {
            background: "#f56565",
            color: "#fff",
            fontWeight: "bold",
          },
        });

        return;
      }
      setStep("senha");
      setTimeout(() => senhaRef.current?.focus(), 0);
      return;
    }

    setLoading(true);

    const res = await signIn("credentials", {
      redirect: false, // Keep false to handle errors properly
      cpf: cpf.replace(/\D/g, ""),
      password,
    });

    setLoading(false);

    if (res?.error) {
      toast.error("CPF ou senha inválidos", { style: { background: "#f56565", color: "#fff", fontWeight: "bold" } });
      return;
    }

    if (res?.ok) {
      toast.success("Login efetuado!", { style: { background: "#adfacfff", color: "#000", fontWeight: "bold" } });

      // Pequeno delay para garantir que o cookie foi processado pelo browser
      // e o toast seja visível por um momento
      setTimeout(() => {
        window.location.href = "/";
      }, 800);
      return;
    }

    toast.error("Não foi possível efetuar o login. Tente novamente.");
  };

  const handleCpfKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (validarCpf(cpf)) {
        setStep("senha");
        setTimeout(() => senhaRef.current?.focus(), 0);
      } else {
        toast.error("CPF inválido", {
          style: { background: "#f56565", color: "#fff", fontWeight: "bold" },
        });
      }
    }
  };

  const handleVoltar = () => {
    setStep("cpf");
    setTimeout(() => cpfRef.current?.focus(), 0);
  };

  const handleHelpRedirect = (issue: string) => {
    const phone = "5561996679408";
    const text = encodeURIComponent(`Olá, estou com problemas no login: ${issue}`);
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
    setIsHelpOpen(false);
  };

  return (
    <main className={`${tema.mainBg} min-h-screen flex flex-col items-center justify-center px-4`} style={{ fontFamily: "'Inter', sans-serif" }}>

      <button
        onClick={toggleAudio}
        className="absolute top-4 right-12 p-2 rounded-full transition"
        title={audioHabilitado ? "Áudio habilitado" : "Áudio desabilitado"}
      >
        {audioHabilitado ? <FiVolume2 size={20} className="dark:text-gray-200" /> : <FiVolumeX size={20} className="dark:text-gray-200" />}
      </button>

      <button
        onClick={toggleTheme}
        aria-label="Alternar tema claro/escuro"
        className="absolute top-4 right-4 p-2 rounded-full transition"
      >
        {themeName === "dark" ? <div className="w-5 h-5 bg-gray-700 border-2 border-gray-700 rounded-full" /> : <div className="w-5 h-5 rounded-full border-2 border-gray-400" />}
      </button>

      <div className={`max-w-md w-full rounded-xl shadow-md p-8 space-y-6 ${tema.mainBg}`}>

        <div className="flex flex-col items-center mb-12">
          <img src="/Anamnex-Cliv.png" alt="Anamnex by Cliv" className="w-[200px] mb-12" />
          <h1 className={`text-3xl font-bold tracking-tight ${tema.textPrimary} select-none mb-2`}>Acessar conta</h1>
        </div>

        <Toaster />

        <p className={`text-sm ${tema.textPrimary} text-left`}>Sua saúde em primeiro lugar. Preencha seus dados para continuar.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          {step === "cpf" && (
            <label className="block relative">
              <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={cpfRef}
                type="text"
                placeholder="Digite seu CPF"
                className={`w-full rounded-md border pl-10 pr-4 py-3 text-sm ${tema.textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                onKeyDown={handleCpfKeyDown}
                required
                disabled={loading}
              />
            </label>
          )}

          {step === "senha" && (
            <>
              <div className="flex justify-between items-center mb-2">
                <button
                  type="button"
                  onClick={handleVoltar}
                  className="flex items-center text-sm text-blue-500 hover:underline"
                  disabled={loading}
                >
                  <FiArrowLeft className="mr-1" /> Voltar
                </button>
                <span className="text-sm font-medium text-gray-500">{cpf}</span>
              </div>

              <label className="block relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={senhaRef}
                  type={mostrarSenha ? "text" : "password"}
                  placeholder="Senha"
                  className={`w-full rounded-md border pl-10 pr-12 py-3 text-sm ${tema.textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  tabIndex={-1}
                  aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
                  disabled={loading}
                >
                  {mostrarSenha ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </label>
            </>
          )}

          <p className={`text-xs ${tema.textPrimary} max-w-xs`}>
            Ao entrar, você concorda com os nossos{" "}
            <button type="button" onClick={() => setIsTermosOpen(true)} className={`underline ${tema.linkColor}`} disabled={loading}>
              Termos de Uso
            </button>
            .
          </p>

          <button
            type="submit"
            className={`w-full py-3 rounded-md font-semibold text-white ${tema.btnBg} ${tema.btnHover} transition mt-10`}

          >
            {loading ? "Verificando..." : step === "cpf" ? "Avançar" : "Entrar"}
          </button>
        </form>

        <Link
          href="/cadastro"
          className={`w-full border rounded-md py-2 flex items-center justify-center space-x-2 text-sm ${tema.textPrimary} hover:bg-gray-100 dark:hover:bg-gray-700 transition`}
        >
          <span>Criar uma conta</span>
        </Link>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="text-sm text-blue-500 hover:underline mt-2"
          >
            Problemas no login?
          </button>
        </div>
      </div>

      <footer className={`mt-12 mb-4 text-xs ${tema.textPrimary}`}>Cliv @ 2025 - Versão 3.1.2</footer>

      <BottomSheetModal isOpen={isTermosOpen} onClose={() => setIsTermosOpen(false)} className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Termos de Uso</h2>
          <button onClick={() => setIsTermosOpen(false)} className="p-1 rounded-full hover:bg-gray-200 transition">
            <FiX size={20} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto pr-2">
          <p className="text-sm text-gray-600 leading-relaxed">
            <strong>1. Aceitação dos Termos</strong><br />
            Ao acessar e utilizar o Sistema Anamnex de pré-triagem e anamnese automatizada, o usuário concorda com os presentes Termos de Uso. Caso não concorde, o usuário não deverá utilizar o Sistema.
          </p>

          <p className="text-sm text-gray-600 leading-relaxed mt-4">
            <strong>2. Finalidade do Sistema</strong><br />
            O Anamnex tem como objetivo auxiliar no processo de pré-triagem de pacientes, identificando sintomas, sugerindo classificações de riscos, sugerindo exames e procedimentos, e integrando com serviços de telemedicina quando aplicável. O Sistema não substitui o diagnóstico médico, servindo apenas como ferramenta de apoio.
          </p>

          <p className="text-sm text-gray-600 leading-relaxed mt-4">
            <strong>3. Coleta e Tratamento de Dados Pessoais</strong><br />
            Conforme a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 – LGPD):<br />
            • Os dados pessoais e sensíveis (como informações de saúde) são coletados exclusivamente para a execução das funcionalidades do Anamnex.<br />
            • Os dados poderão incluir informações fornecidas por voz ou texto, histórico de atendimentos, sintomas relatados e classificações de risco.<br />
            • Todo tratamento de dados será realizado com base legal adequada, priorizando o consentimento do titular e/ou o legítimo interesse para prestação do serviço.
          </p>

          <p className="text-sm text-gray-600 leading-relaxed mt-4">
            <strong>4. Armazenamento e Segurança</strong><br />
            • Os dados serão armazenados em servidores seguros, com criptografia em repouso e em trânsito.<br />
            • O acesso aos dados é restrito a profissionais autorizados, conforme necessidade operacional.<br />
            • Medidas técnicas e administrativas serão adotadas para prevenir acessos não autorizados, vazamentos e incidentes de segurança.
          </p>

          <p className="text-sm text-gray-600 leading-relaxed mt-4">
            <strong>5. Compartilhamento de Dados</strong><br />
            • Os dados poderão ser compartilhados com profissionais de saúde responsáveis pelo atendimento.<br />
            • Em casos de integração com serviços de telemedicina, apenas as informações necessárias ao atendimento serão transmitidas.<br />
            • Não haverá venda ou compartilhamento de dados para fins comerciais.
          </p>

          <p className="text-sm text-gray-600 leading-relaxed mt-4">
            <strong>6. Direitos do Titular dos Dados</strong><br />
            O titular poderá, a qualquer momento:<br />
            • Solicitar confirmação da existência de tratamento de seus dados.<br />
            • Acessar, corrigir, atualizar ou solicitar exclusão de seus dados.<br />
            • Revogar o consentimento fornecido.<br />
            As solicitações poderão ser feitas por meio dos canais de atendimento indicados pelo controlador do Sistema.
          </p>

          <p className="text-sm text-gray-600 leading-relaxed mt-4">
            <strong>7. Responsabilidades e Limitações</strong><br />
            O Anamnex é uma ferramenta de apoio e não substitui o julgamento profissional médico.<br />
            A responsabilidade por diagnósticos e condutas médicas é exclusivamente do profissional de saúde.<br />
            O fornecedor do Anamnex não se responsabiliza por decisões clínicas tomadas exclusivamente com base nas informações fornecidas pelo Sistema.
          </p>

          <p className="text-sm text-gray-600 leading-relaxed mt-4">
            <strong>8. Alterações nos Termos de Uso</strong><br />
            Estes Termos poderão ser alterados a qualquer momento, mediante publicação da nova versão no Sistema. O uso continuado do Anamnex após a alteração implica concordância com os novos termos.
          </p>

          <p className="text-sm text-gray-600 leading-relaxed mt-4">
            <strong>9. Contato</strong><br />
            Para dúvidas, solicitações ou exercício de direitos relacionados à LGPD, o usuário poderá entrar em contato com o Encarregado de Proteção de Dados pelo e-mail.
          </p>

          <p className="text-sm text-gray-600 leading-relaxed mt-4">
            <strong>10. Vigência</strong><br />
            Estes Termos de Uso entram em vigor na data de seu aceite e permanecerão válidos enquanto o usuário utilizar o Anamnex.
          </p>
        </div>

        <button
          onClick={() => setIsTermosOpen(false)}
          className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-md transition"
        >
          Fechar
        </button>
      </BottomSheetModal>

      <BottomSheetModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} className="p-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Como podemos ajudar?</h2>
          <button onClick={() => setIsHelpOpen(false)} className="p-2 rounded-full hover:bg-gray-100 transition">
            <FiX size={24} />
          </button>
        </div>

        <div className="space-y-3">
          {[
            "Esqueci minha senha",
            "Não consigo acessar com meu CPF",
            "Erro ao carregar a página",
            "Outro problema",
          ].map((issue) => (
            <button
              key={issue}
              onClick={() => handleHelpRedirect(issue)}
              className="w-full text-left p-4 border rounded-xl hover:bg-gray-50 hover:border-blue-500 transition-all font-medium text-gray-700 flex justify-between items-center group"
            >
              {issue}
              <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </button>
          ))}
          
          <button
            onClick={() => setIsHelpOpen(false)}
            className="w-full mt-4 py-3 text-gray-500 font-medium hover:underline"
          >
            Voltar para o login
          </button>
        </div>
      </BottomSheetModal>
    </main>
  );
}
