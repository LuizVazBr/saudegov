"use client";

import React, { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast"; 
import HeaderConfiguracoes from "@/components/HeaderIn";
import { useTheme } from "@/components/ThemeProvider";
import { Session } from "next-auth";

interface Props {
  sessionServer: Session;
}

export default function ClientConfiguracoes({ sessionServer }: Props) {
  const { tema, themeName, toggleTheme } = useTheme();

  const [falarTextos, setFalarTextos] = useState(true);
  const [autenticacao2F, setAutenticacao2F] = useState(false);
  const [tempoCompartilhar, setTempoCompartilhar] = useState("43200");
  const [notificacoes, setNotificacoes] = useState(true);

  // 🔹 Desregistrar SW antigo que pode segurar cache
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
    }
  }, []);

  // 🔹 Carregar configuração do banco
  useEffect(() => {
    if (!sessionServer?.user?.id) return;

    async function fetchConfig() {
      try {
        const res = await fetch("/api/configuracoes", {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });
        if (!res.ok) throw new Error("Erro ao carregar configurações");
        const data = await res.json();
        if (data.config) {
          setFalarTextos(data.config.falarTextos ?? true);
          setAutenticacao2F(data.config.autenticacao2F ?? false);
          setTempoCompartilhar(data.config.tempoCompartilhar ?? "43200");
          setNotificacoes(data.config.notificacoes ?? true);
        }
      } catch (err) {
        console.error(err);
        toast.error("Não foi possível carregar configurações");
      }
    }

    fetchConfig();
  }, [sessionServer]);

  const salvarConfig = async (novaConfig: any) => {
    if (!sessionServer?.user?.id) return;

    const toastId = "salvando-config";
    toast.loading("Salvando configurações...", { id: toastId });

    try {
      const res = await fetch("/api/configuracoes", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        body: JSON.stringify({ config: novaConfig }),
      });

      if (!res.ok) throw new Error("Erro ao salvar configurações");
      toast.success("Configurações salvas!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configurações", { id: toastId });
    }
  };

  // Handlers que salvam automaticamente
  const handleTempoCompartilhar = (value: string) => {
    setTempoCompartilhar(value);
    salvarConfig({ falarTextos, autenticacao2F, tempoCompartilhar: value, notificacoes });
  };

  const handleNotificacoes = (value: boolean) => {
    setNotificacoes(value);
    salvarConfig({ falarTextos, autenticacao2F, tempoCompartilhar, notificacoes: value });
  };

  const handleFalarTextos = (value: boolean) => {
    setFalarTextos(value);
    salvarConfig({ falarTextos: value, autenticacao2F, tempoCompartilhar, notificacoes });
  };

  const handleAutenticacao2F = (value: boolean) => {
    setAutenticacao2F(value);
    salvarConfig({ falarTextos, autenticacao2F: value, tempoCompartilhar, notificacoes });
  };

  const handleReset = () => {
    if (confirm("Tem certeza que deseja resetar todos os dados do app?")) {
      toast.loading("Resetando configurações...");
      salvarConfig({ falarTextos: true, autenticacao2F: false, tempoCompartilhar: "43200", notificacoes: true });
      setFalarTextos(true);
      setAutenticacao2F(false);
      setTempoCompartilhar("43200");
      setNotificacoes(true);
      toast.success("Configurações resetadas!");
    }
  };

  return (
    <main className={`${tema.mainBg} min-h-screen`}>
      <HeaderConfiguracoes paginaAtiva="configuracoes" tipoU="" sessionServer={sessionServer} />

      <div className="p-5 max-w-xl mx-auto space-y-6">
        <h1 className={`text-2xl font-bold ${tema.textPrimary}`}>Configurações</h1>
        <p className={`text-sm ${tema.textSecondary}`}>
          Ajustes gerais do aplicativo, notificações e preferências.
        </p>

        {/* Compartilhar dados com médico */}
        <div className="flex flex-col">
          <label className="text-gray-700 dark:text-gray-300 font-medium mb-1">Compartilhar dados com médico</label>
          <select
            value={tempoCompartilhar}
            onChange={(e) => handleTempoCompartilhar(e.target.value)}
            className="border rounded px-3 py-2 text-sm text-gray-600 dark:text-gray-300"
          >
            <option value="43200">Compartilhar</option>
            <option value="0">Não compartilhar</option>
            <option value="15">15 minutos</option>
            <option value="30">30 minutos</option>
            <option value="60">1 hora</option>
            <option value="120">2 horas</option>
          </select>
        </div>

        {/* Notificações */}
        <div className="flex items-center justify-between">
          <span className="text-gray-700 dark:text-gray-300 font-medium">Notificações</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={notificacoes}
              onChange={() => handleNotificacoes(!notificacoes)}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-all"></div>
            <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform transition-all peer-checked:translate-x-5"></span>
          </label>
        </div>

        {/* Tema escuro */}
        <div className="flex items-center justify-between">
          <span className="text-gray-700 dark:text-gray-300 font-medium">Tema escuro</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={themeName === "dark"}
              onChange={() => {
                toggleTheme();
                salvarConfig({
                  falarTextos,
                  autenticacao2F,
                  tempoCompartilhar,
                  notificacoes,
                  theme: themeName === "dark" ? "light" : "dark",
                });
              }}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-all"></div>
            <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform transition-all peer-checked:translate-x-5"></span>
          </label>
        </div>
      </div>

      <Toaster position="top-right" />
    </main>
  );
}
