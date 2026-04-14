import { useEffect } from "react";
import { toast } from "react-hot-toast";

export default function GlobalFilaListener({ pacienteId }: { pacienteId: string }) {
    useEffect(() => {
        if (!pacienteId) return;

        // Pedir permissão para notificação push
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        let isChamado = false;

        const checkFila = async () => {
            try {
                const res = await fetch(`/api/fila/status?pacienteId=${pacienteId}`);
                if (!res.ok) return;
                const data = await res.json();

                if (data.status === "chamado") {
                    if (!isChamado) {
                        isChamado = true;

                        // Push Notification
                        if ("Notification" in window && Notification.permission === "granted") {
                            new Notification("Sua Consulta Chegou!", {
                                body: "O médico está te esperando para a consulta online. Você tem 2 minutos para entrar.",
                                icon: "/icon.png" // Opcional, se tiver ícone
                            });
                        }

                        // Modal/Toast em tela persistente
                        toast.custom((t) => (
                            <div className="max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex flex-col ring-1 ring-black ring-opacity-5">
                                <div className="p-4 flex items-start">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-2">Consulta Iniciada</h3>
                                        <p className="mt-1 text-sm text-gray-500">
                                            O médico está te aguardando na sala de telemedicina! Clique abaixo para entrar.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex border-l border-gray-200 p-4 pt-0 gap-2">
                                    <button
                                        onClick={() => {
                                            toast.dismiss(t.id);
                                            window.location.href = "/fila-telemedicina";
                                        }}
                                        className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                                    >
                                        Entrar na Sala
                                    </button>
                                </div>
                            </div>
                        ), { duration: 120000 }); // Duração de 2 min no toast
                    }
                } else {
                    isChamado = false;
                }
            } catch (e) {
                console.error("Erro no listener global de fila:", e);
            }
        };

        const interval = setInterval(checkFila, 5000);
        checkFila();

        return () => clearInterval(interval);
    }, [pacienteId]);

    return null;
}
