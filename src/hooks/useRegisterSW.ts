"use client";
import { useEffect, useRef } from "react";

const useRegisterSW = (status: string, pacienteId: string) => {
  const sentRef = useRef(false);

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  useEffect(() => {
    const registerSWAndSubscribe = async () => {
      if (!("serviceWorker" in navigator) || sentRef.current) return;

      sentRef.current = true; // ⬅️ evita múltiplas execuções

      try {
        // 0️⃣ Remove antigo sw.js se existir para evitar conflitos e loop de cache
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          if (registration.active?.scriptURL.endsWith('/sw.js')) {
            console.log("Removendo SW antigo (/sw.js) para evitar conflitos.");
            await registration.unregister();
          }
        }

        // 1️⃣ Registra o SW (idempotente - navegador cuida das atualizações)
        const reg = await navigator.serviceWorker.register("/sw-custom.js", { scope: "/" });
        console.log("Service Worker registrado com sucesso:", reg);

        // Aguarda ativação para garantir acesso ao pushManager
        await navigator.serviceWorker.ready;

        // 2️⃣ Permissões de notificação
        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            console.warn("Permissão de notificação não concedida.");
            return;
          }
        } else if (Notification.permission === "denied") {
          console.warn("Permissão de notificação negada anteriormente.");
          return;
        }

        // 3️⃣ Verifica se já existe inscrição via LocalStorage + getSubscription
        const localSub = localStorage.getItem("push_subscribed_v2");
        const existingSub = await reg.pushManager.getSubscription();

        if (existingSub) {
          console.log("Push subscription já existe no browser.", existingSub);
          if (!localSub) localStorage.setItem("push_subscribed_v2", "true");
          return;
        }

        if (localSub) {
          console.log("Push subscription marcada como existente no storage, ignorando recriação.");
          return;
        }

        try {
          const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
              "BNqj276kNGDlNaWysnY6s18qm0xRm99BJaiVMLJDf6aREWs7ztGebpmE12Fj3zOuwvdCSUKYXgKC2WGoq-sc-hU"
            ),
          });

          await fetch("/api/save-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pacienteId, subscription }),
          });

          // Inscrição salva com sucesso
          localStorage.setItem("push_subscribed_v2", "true");
        } catch (pushErr) {
          // Navegador bloqueou o push (ex: Brave) ou deu erro de serviço.
          // Marcamos como 'failed' para não tentar de novo a cada reload.
          localStorage.setItem("push_subscribed_v2", "failed");
        }

      } catch (err) {
        console.error("Erro geral no Service Worker:", err);
      }
    };

    if (status === "authenticated") registerSWAndSubscribe();
  }, [status, pacienteId]);
};

export default useRegisterSW;
