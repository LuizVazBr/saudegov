"use client";

import { useEffect, useRef } from "react";

export default function TesteWhatsApp() {
  const jaEnviado = useRef(false); // evita envio duplicado em StrictMode

  useEffect(() => {
    if (jaEnviado.current) return; // se já enviou, não envia novamente
    jaEnviado.current = true;

    async function enviarWhatsAppTeste() {
      const numero = "61996679408";
      const sintomas = "Febre, tosse e dor de cabeça";
      const classificacao = "Verde";
      const unidade = "UBS Araguaína Sul";
      const observacoes = "Paciente sem histórico relevante";

      // Endereço ou coordenadas
      const endereco = "UBS Araguaína Sul, Araguaína, TO";
      const linkMapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        endereco
      )}`;

      // Emoji de risco
      const cores = {
        Azul: "🔵",
        Verde: "🟢",
        Amarelo: "🟡",
        Laranja: "🟠",
        Vermelho: "🔴",
      };
      const emojiRisco = cores[classificacao] || "⚪";

      // Mensagem completa
      const mensagemCompleta = `
Sintomas registrados: ${sintomas}
${emojiRisco} Classificação de risco: ${classificacao} 🔹 Atendimento: ${unidade}
Localização: ${linkMapa}
Observações: ${observacoes}
`;

      try {
        const response = await fetch("/api/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: numero,
            headerText: "Resultado da Triagem",
            bodyVar1: mensagemCompleta, // tudo em um único parâmetro
          }),
        });

        const data = await response.json();
        console.log("Resposta da API /whatsapp:", data);
        alert("Mensagem enviada! Verifique o console para resposta.");
      } catch (err) {
        console.error("Erro ao enviar WhatsApp:", err);
        alert("Erro ao enviar WhatsApp. Veja o console.");
      }
    }

    enviarWhatsAppTeste();
  }, []);

  return (
    <main className="flex items-center justify-center h-screen">
      <p className="text-lg font-medium">Testando envio de WhatsApp...</p>
    </main>
  );
}
