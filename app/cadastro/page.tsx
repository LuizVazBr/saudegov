"use client";

import { useState, useEffect, useRef } from "react";
import { FiEye, FiEyeOff, FiArrowLeft, FiVolume2, FiVolumeX, FiX } from "react-icons/fi";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import BottomSheetModal from "@/components/BottomSheetModal";
import { useTheme } from "@/components/ThemeProvider";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useAudioPlayer } from "../../components/AudioPlayer";

export default function CadastroPage() {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [step, setStep] = useState(0);

  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [nomeMae, setNomeMae] = useState("");
  const [sexo, setSexo] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [sus, setSus] = useState("");
  const [email, setEmail] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState(false);
  const [password, setPassword] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const [isTermosOpen, setIsTermosOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { tema, themeName, toggleTheme } = useTheme();

  const { audioHabilitado, toggleAudio, isPlaying, togglePlay } = useAudioPlayer(tema);

  const camposOpcionais = ["Email", "Complemento"];

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [step]);

  useEffect(() => {
    document.body.style.overflow = isTermosOpen ? "hidden" : "auto";
  }, [isTermosOpen]);

  const steps = [
    { label: "CPF", value: cpf, setValue: setCpf, type: "text" },
    { label: "Nome completo", value: nome, setValue: setNome, type: "text" },
    { label: "Nome da mãe", value: nomeMae, setValue: setNomeMae, type: "text" },
    { label: "Sexo", value: sexo, setValue: setSexo, type: "select" },
    { label: "Data de nascimento", value: nascimento, setValue: setNascimento, type: "date" },
    { label: "Número SUS", value: sus, setValue: setSus, type: "text" },
    /*{ label: "Email", value: email, setValue: setEmail, type: "email" },*/
    { label: "CEP", value: cep, setValue: setCep, type: "text" },
    { label: "Endereço", value: endereco, setValue: setEndereco, type: "text" },
    { label: "Número", value: numero, setValue: setNumero, type: "text" },
    { label: "Complemento", value: complemento, setValue: setComplemento, type: "text" },
    { label: "Telefone Celular", value: telefone, setValue: setTelefone, type: "text" },
    { label: "Senha", value: password, setValue: setPassword, type: mostrarSenha ? "text" : "password" },
  ];

  // Validações e buscas
  const validarCpf = (cpf: string) => {
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpfLimpo)) return false;

    let soma = 0;
    let resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpfLimpo.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpfLimpo.substring(9, 10))) return false;

    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpfLimpo.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpfLimpo.substring(10, 11))) return false;

    return true;
  };

  const validarEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toLowerCase());

  const buscarDadosCpf = async (cpfLimpo: string) => {
    const loading = toast.loading("Buscando dados pelo CPF...");
    try {
      const res = await fetch(`https://api.cpfcnpj.com.br/1af91434af60a172744b9fb8fd1bb999/2/${cpfLimpo}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.dismiss(loading);

      if (!res.ok) {
        toast.error("Erro ao buscar CPF");
        return;
      }

      const data = await res.json();

      if (data.status === 1) {
        setNome(data.nome || "");
        setNomeMae(data.mae || "");

        if (data.genero) {
          if (data.genero === "M") setSexo("Masculino");
          else if (data.genero === "F") setSexo("Feminino");
          else setSexo("");
        }

        if (data.nascimento) {
          const [dia, mes, ano] = data.nascimento.split("/");
          setNascimento(`${dia}/${mes}/${ano}`);
        }
        toast.success("Dados preenchidos com sucesso!");
      } else {
        toast.error("CPF não encontrado ou inválido");
      }
    } catch {
      toast.dismiss(loading);
      toast.error("Erro ao consultar CPF");
    }
  };

  const validarDataNascimento = (data: string) => {
    // Verifica se tem exatamente DD/MM/YYYY
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = data.match(regex);
    if (!match) return false;

    const dia = parseInt(match[1], 10);
    const mes = parseInt(match[2], 10);
    const ano = parseInt(match[3], 10);

    if (mes < 1 || mes > 12) return false;
    if (dia < 1 || dia > 31) return false;

    // Meses com 30 dias
    if ([4, 6, 9, 11].includes(mes) && dia > 30) return false;

    // Fevereiro e ano bissexto
    const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
    if (mes === 2 && ((bissexto && dia > 29) || (!bissexto && dia > 28))) return false;

    return true;
  };

  const buscarEnderecoPorCep = async (cepLimpo: string) => {
    if (cepLimpo.length !== 8) return;

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();

      if (data.erro) {
        toast.error("CEP não encontrado");
        return;
      }

      const enderecoCompleto = `${data.logradouro || ""}, ${data.bairro || ""}, ${data.localidade || ""} - ${data.uf || ""}`;
      setEndereco(enderecoCompleto);
      toast.success("Endereço preenchido automaticamente!");
    } catch {
      toast.error("Erro ao buscar endereço");
    }
  };

  const handleCadastro = async () => {
    const loading = toast.loading("Realizando cadastro...");
    try {

      let dataParaBanco = null;
      if (nascimento) {
        
        let [dia, mes, ano] = nascimento.split("/");

        if (dia && mes && ano) {
          dia = dia.padStart(2, "0");
          mes = mes.padStart(2, "0");

          dataParaBanco = `${ano}-${mes}-${dia}`;
        }
      }


      const res = await fetch("/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          senha: password,
          tipo_usuario: "paciente",
          documento: cpf,
          telefone,
          telefone_whatsapp: whatsapp,
          data_nascimento: dataParaBanco,
          numero_sus: sus,
          nome_mae: nomeMae,
          sexo,
          cep,
          endereco,
          numero,
          complemento,
        }),
      });

      const data = await res.json();
      toast.dismiss(loading);

      if (data.success) {
        toast.success("Cadastro realizado com sucesso!");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000); // espera 1 segundo antes de redirecionar
      } else {
        toast.error(`Erro: ${data.error || "Não foi possível cadastrar"}`);
      }


    } catch {
      toast.dismiss(loading);
      toast.error("Erro ao cadastrar usuário");
    }
  };

  const handleNext = async () => {
    //if (!steps[step].value) {
    if (!steps[step].value && !camposOpcionais.includes(steps[step].label)) {
      toast.error(`Preencha ${steps[step].label}`, { position: "top-center" });
      return;
    }

    if (steps[step].label === "CPF") {
      const cpfLimpo = cpf.replace(/\D/g, "");
      if (!validarCpf(cpfLimpo)) {
        toast.error("CPF inválido");
        return;
      }
      await buscarDadosCpf(cpfLimpo);
    }

    if (steps[step].label === "Email" && email) {
      if (!validarEmail(email)) {
        toast.error("Email inválido");
        return;
      }
    }

    if (steps[step].label === "CEP") {
      const cepLimpo = cep.replace(/\D/g, "");
      await buscarEnderecoPorCep(cepLimpo);
    }

    if (steps[step].label === "Data de nascimento") {
      if (!validarDataNascimento(nascimento)) {
        toast.error("Data de nascimento inválida");
        return; // impede avançar
      }

      // Formata para enviar ao banco
      //const [dia, mes, ano] = nascimento.split("/").map(Number);
      //const formatted = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      //steps[step].setValue(formatted); // <- ISSO está mudando o valor na tela
    }


    if (step < steps.length - 1) setStep(step + 1);
    else handleCadastro();
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleHelpRedirect = (issue: string) => {
    const phone = "5561996679408";
    const text = encodeURIComponent(`Olá, estou com problemas no cadastro: ${issue}`);
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
    setIsHelpOpen(false);
  };

  const formatarCpf = (value: string) => {
    const cpfNum = value.replace(/\D/g, "").slice(0, 11);
    return cpfNum
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const formatarTelefone = (value: string) => {
    const numeros = value.replace(/\D/g, "").slice(0, 11);
    if (numeros.length <= 2) return `(${numeros}`;
    if (numeros.length <= 6) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  };

  const formatarCep = (value: string) => {
    const numeros = value.replace(/\D/g, "").slice(0, 8);
    if (numeros.length > 5) return numeros.slice(0, 5) + "-" + numeros.slice(5);
    return numeros;
  };

  return (
    <main className={`${tema.mainBg} min-h-screen flex flex-col items-center justify-center px-4`} style={{ fontFamily: "'Inter', sans-serif" }}>
      <Toaster />

      <button
        onClick={toggleAudio}
        className="absolute top-4 right-12 p-2 rounded-full transition"
        title={audioHabilitado ? "Áudio habilitado" : "Áudio desabilitado"}
      >
        {audioHabilitado ? <FiVolume2 size={20} className="dark:text-gray-200" /> : <FiVolumeX size={20} className="dark:text-gray-200" />}
      </button>

      <button onClick={toggleTheme} aria-label="Alternar tema" className="absolute top-4 right-4 p-2 rounded-full transition">
        {themeName === "dark" ? <div className="w-5 h-5 bg-gray-700 border-2 border-gray-700 rounded-full" /> : <div className="w-5 h-5 rounded-full border-2 border-gray-400" />}
      </button>

      <div className={`max-w-md w-full rounded-xl shadow-md p-8 space-y-6 ${tema.mainBg}`}>
        <div className="flex flex-col items-center mb-12">
          <img src="/Anamnex-Cliv.png" alt="Anamnex by Cliv" className="w-[200px] mb-12" />
          <h1 className={`text-3xl font-bold tracking-tight ${tema.textPrimary} select-none mb-2`}>Crie uma conta</h1>
        </div>

        <p className={`text-sm ${tema.textPrimary} text-center`}>Preencha seus dados passo a passo para se cadastrar.</p>
        <p className={`text-sm font-medium text-gray-400 mb-2`}>Passo {step + 1}/{steps.length}</p>

        {step > 0 && (
          <div className="flex justify-between items-center mb-2">
            <button type="button" onClick={handlePrev} className="flex items-center text-sm text-blue-500 hover:underline">
              <FiArrowLeft className="mr-1" /> Voltar
            </button>
            <span className="text-sm font-medium text-gray-400">{steps[step - 1].value}</span>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-400">{`Preencha ${steps[step].label}`}</label>

          {steps[step].type === "date" ? (
           /*<DatePicker
            selected={steps[step].value ? new Date(steps[step].value) : null}
            onChange={(date: Date | null) => {
              if (!date) return;

              const ano = date.getFullYear();
              const mes = String(date.getMonth() + 1).padStart(2, "0");
              const dia = String(date.getDate()).padStart(2, "0");

              // Armazena em formato aaaa-mm-dd
              steps[step].setValue(`${ano}-${mes}-${dia}`);
            }}
            dateFormat="dd/MM/yyyy" // exibição
            placeholderText={steps[step].label}
            className={`w-full rounded-md border pl-4 py-3 text-sm ${tema.textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            onKeyDown={(e) => e.key === "Enter" && handleNext()}
          />*/
          <input
            ref={inputRef}
            type="text"
            placeholder="Data de nascimento (dd/mm/yyyy)"
            className={`w-full rounded-md border pl-4 py-3 text-sm ${tema.textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            value={nascimento}
            onChange={(e) => {
              let value = e.target.value.replace(/\D/g, ""); // remove tudo que não é número
              if (value.length > 8) value = value.slice(0, 8); // limita a 8 números

              // adiciona barras automaticamente
              if (value.length > 2) value = value.slice(0, 2) + "/" + value.slice(2);
              if (value.length > 5) value = value.slice(0, 5) + "/" + value.slice(5);

              setNascimento(value); // apenas atualiza o texto digitado
            }}
            onKeyDown={(e) => e.key === "Enter" && handleNext()}
          />
          ) : steps[step].label === "CPF" ? (
            <input
              ref={inputRef}
              type="text"
              placeholder={steps[step].label}
              className={`w-full rounded-md border pl-4 py-3 text-sm ${tema.textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              value={formatarCpf(steps[step].value)}
              onChange={(e) => steps[step].setValue(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
            />
          ) : steps[step].label === "Sexo" ? (
            <select
              ref={selectRef}
              className={`w-full rounded-md border pl-4 py-3 text-sm ${tema.textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              value={steps[step].value}
              onChange={(e) => steps[step].setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
            >
              <option value="">Selecione</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </select>
          ) : steps[step].label === "CEP" ? (
            <input
              ref={inputRef}
              type="text"
              placeholder={steps[step].label}
              className={`w-full rounded-md border pl-4 py-3 text-sm ${tema.textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              value={formatarCep(steps[step].value)}
              onChange={(e) => steps[step].setValue(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
            />
          ) : steps[step].label === "Telefone Celular" ? (
            <div className="flex items-center space-x-2">
              <input
                ref={inputRef}
                type="text"
                placeholder={steps[step].label}
                className={`flex-1 rounded-md border pl-4 py-3 text-sm ${tema.textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                value={formatarTelefone(steps[step].value)}
                onChange={(e) => steps[step].setValue(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleNext()}
              />
              <label className="flex items-center space-x-1 text-sm">
                <input type="checkbox" checked={whatsapp} onChange={() => setWhatsapp(!whatsapp)} />
                <span>WhatsApp</span>
              </label>
            </div>
          ) : steps[step].label === "Senha" ? (
            <div className="relative">
              <input
                ref={inputRef}
                type={mostrarSenha ? "text" : "password"}
                placeholder={steps[step].label}
                className={`w-full rounded-md border pl-4 pr-12 py-3 text-sm ${tema.textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                value={steps[step].value}
                onChange={(e) => steps[step].setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNext()}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {mostrarSenha ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          ) : (
            <input
              ref={inputRef}
              type={steps[step].type}
              placeholder={steps[step].label}
              className={`w-full rounded-md border pl-4 py-3 text-sm ${tema.textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              value={steps[step].value}
              onChange={(e) => steps[step].setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
            />
          )}
        </div>

        <p className={`text-xs ${tema.textPrimary} max-w-xs`}>
          Ao cadastrar, você concorda com os nossos{" "}
          <button type="button" onClick={() => setIsTermosOpen(true)} className={`underline ${tema.linkColor}`}>
            Termos de Uso
          </button>
          .
        </p>

        <button type="button" onClick={handleNext} className={`w-full py-3 mb-10 rounded-md font-semibold text-white ${tema.btnBg} ${tema.btnHover} transition`}>
          {step === steps.length - 1 ? "Finalizar" : "Próximo"}
        </button>

        <Link href="/login" className={`w-full border rounded-md py-2 flex items-center justify-center space-x-2 text-sm ${tema.textPrimary} hover:bg-gray-100 dark:hover:bg-gray-700 transition`}>
          <span>Voltar para login</span>
        </Link>

        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="text-sm text-blue-500 hover:underline"
          >
            Problemas no cadastro?
          </button>
        </div>
      </div>

      {/* Modal Termos */}
      <BottomSheetModal isOpen={isTermosOpen} onClose={() => setIsTermosOpen(false)}>
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

      {/* Modal Ajuda */}
      <BottomSheetModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} className="p-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Problemas no cadastro?</h2>
          <button onClick={() => setIsHelpOpen(false)} className="p-2 rounded-full hover:bg-gray-100 transition">
            <FiX size={24} />
          </button>
        </div>

        <div className="space-y-3">
          {[
            "Problema com preenchimento do CPF",
            "CEP/Endereço não encontrado",
            "Erro ao finalizar cadastro",
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
            Voltar para o cadastro
          </button>
        </div>
      </BottomSheetModal>
    </main>
  );
}
