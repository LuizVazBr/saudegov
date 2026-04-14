"use client";

import { useState, useEffect } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function Login() {
  const [temaDark, setTemaDark] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [emailOuTelefone, setEmailOuTelefone] = useState("");
  const [senha, setSenha] = useState("");

  // Carrega o tema salvo no primeiro render
  useEffect(() => {
    const temaSalvo = localStorage.getItem("temaDark");
    if (temaSalvo !== null) {
      setTemaDark(temaSalvo === "true");
    }
  }, []);

  // Salva no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem("temaDark", String(temaDark));
  }, [temaDark]);

  const temaClaro = {
    bgMain: "bg-white",
    textPrimary: "text-gray-900",
    inputBg: "bg-gray-50",
    inputBorder: "border-gray-300",
    placeholder: "placeholder-gray-400",
    buttonBg: "bg-blue-600",
    buttonHover: "hover:bg-blue-700",
    linkColor: "text-blue-600",
    lineColor: "border-gray-300",
    googleBtnBorder: "border-gray-300",
  };

  const temaEscuro = {
    bgMain: "bg-gray-900",
    textPrimary: "text-gray-100",
    inputBg: "bg-gray-800",
    inputBorder: "border-gray-700",
    placeholder: "placeholder-gray-500",
    buttonBg: "bg-blue-600",
    buttonHover: "hover:bg-blue-700",
    linkColor: "text-blue-400",
    lineColor: "border-gray-700",
    googleBtnBorder: "border-gray-700",
  };

  const tema = temaDark ? temaEscuro : temaClaro;

  return (
    <main
      className={`${tema.bgMain} min-h-screen flex flex-col items-center justify-center px-4`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Toggle tema */}
      <button
        onClick={() => setTemaDark(!temaDark)}
        aria-label="Alternar tema claro/escuro"
        className={`absolute top-4 right-4 p-2 rounded-full bg-gray-200 dark:bg-gray-700 transition`}
      >
        {temaDark ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-yellow-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v1m0 16v1m8.66-10.66l-.7.7M4.05 19.95l-.7.7m15.6-10.6a8 8 0 11-11.3-11.3 8 8 0 0111.3 11.3z"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-gray-800"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v1m0 16v1m8.66-10.66l-.7.7M4.05 19.95l-.7.7m15.6-10.6a8 8 0 11-11.3-11.3 8 8 0 0111.3 11.3z"
            />
          </svg>
        )}
      </button>

      {/* Container login */}
      <div
        className={`max-w-md w-full rounded-xl shadow-md p-8 space-y-6 ${tema.bgMain} border ${tema.lineColor}`}
      >
        {/* Logo */}
        <div className="flex flex-col items-center space-y-3">
          {/* Ícone genérico de baleia */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-12 w-12 ${temaDark ? "text-blue-500" : "text-blue-600"}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M4 15c0-3 4-7 8-7s8 4 8 7-3 6-8 6-8-3-8-6z" />
          </svg>
          <h1
            className={`text-3xl font-bold tracking-tight ${tema.textPrimary} select-none`}
          >
            deepseek
          </h1>
        </div>

        {/* Aviso */}
        <p className={`text-xs ${tema.textPrimary} text-center`}>
          Only login via email, Google, or +86 phone number login is supported in
          your region.
        </p>

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert("Log in clicked!");
          }}
          className="space-y-4"
        >
          {/* Email ou telefone */}
          <label className="block">
            <input
              type="text"
              placeholder="Phone number / email address"
              className={`w-full rounded-md border ${tema.inputBorder} ${tema.inputBg} px-4 py-3 text-sm ${tema.textPrimary} ${tema.placeholder} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              value={emailOuTelefone}
              onChange={(e) => setEmailOuTelefone(e.target.value)}
              required
            />
          </label>

          {/* Senha com botão show/hide */}
          <label className="block relative">
            <input
              type={mostrarSenha ? "text" : "password"}
              placeholder="Password"
              className={`w-full rounded-md border ${tema.inputBorder} ${tema.inputBg} px-4 py-3 pr-12 text-sm ${tema.textPrimary} ${tema.placeholder} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha(!mostrarSenha)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              tabIndex={-1}
              aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
            >
              {mostrarSenha ? <FiEyeOff size={20} /> : <FiEye size={20} />}
            </button>
          </label>

          {/* Consentimento */}
          <p className={`text-xs ${tema.textPrimary} max-w-xs`}>
            By signing up or logging in, you consent to DeepSeek's{" "}
            <a
              href="#"
              className={`underline ${tema.linkColor}`}
              target="_blank"
              rel="noreferrer"
            >
              Terms of Use
            </a>{" "}
            and{" "}
            <a
              href="#"
              className={`underline ${tema.linkColor}`}
              target="_blank"
              rel="noreferrer"
            >
              Privacy Policy
            </a>
            .
          </p>

          {/* Botão log in */}
          <button
            type="submit"
            className={`w-full py-3 rounded-md font-semibold text-white ${tema.buttonBg} ${tema.buttonHover} transition`}
          >
            Log in
          </button>
        </form>

        {/* Links abaixo do botão */}
        <div className="flex justify-between text-sm font-medium">
          <a href="#" className={tema.linkColor + " hover:underline"}>
            Forgot password?
          </a>
          <a href="#" className={tema.linkColor + " hover:underline"}>
            Sign up
          </a>
        </div>

        {/* Linha com OR */}
        <div className="relative flex items-center my-6">
          <div
            className={`flex-grow border-t ${tema.lineColor} border-opacity-50`}
          ></div>
          <span className={`mx-4 text-xs ${tema.textPrimary}`}>OR</span>
          <div
            className={`flex-grow border-t ${tema.lineColor} border-opacity-50`}
          ></div>
        </div>

        {/* Login com Google */}
        <button
          type="button"
          className={`w-full border ${tema.googleBtnBorder} rounded-md py-2 flex items-center justify-center space-x-2 text-sm ${tema.textPrimary} hover:bg-gray-100 dark:hover:bg-gray-700 transition`}
          onClick={() => alert("Login with Google clicked")}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              fill="#EA4335"
              d="M12 10.2v3.6h5.4c-.2 1.2-1.2 3.5-5.4 3.5-3.3 0-6-2.7-6-6s2.7-6 6-6c1.8 0 3.1.8 3.8 1.5l2.6-2.5C16.1 5.4 14.2 4.5 12 4.5 7.6 4.5 4 8.1 4 12.5s3.6 8 8 8c4.6 0 7.7-3.2 7.7-7.7 0-.5-.1-1.1-.2-1.6H12z"
            />
          </svg>
          <span>Log in with Google</span>
        </button>
      </div>

      {/* Rodapé */}
      <footer className={`mt-12 mb-4 text-xs ${tema.textPrimary}`}>
        浙ICP备2023025841号 · Contact us
      </footer>
    </main>
  );
}

