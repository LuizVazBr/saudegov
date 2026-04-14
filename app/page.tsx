import { redirect } from "next/navigation";
import { authOptions } from "../lib/AuthOptions";
import { getServerSession } from "next-auth";
import HomeClient from "../components/HomeClient";

// 🔹 Garante que essa página nunca use cache
export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Redirecionamento por ROLE (Mover logic do middleware para cá - 100% seguro contra Nginx Proxy loops)
  const role = (session.user?.tipo_usuario || "").toString().trim().toLowerCase();
  if (role === "enfermeiro") {
    redirect("/triagem");
  }

  return (
    <HomeClient
      pacienteId={session.user.id}
      pacienteNome={session.user.name || "Paciente"}
      isMonitored={!!session.user.is_monitored}
      sessionServer={session}
    />
  );
}
