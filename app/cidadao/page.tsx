import { redirect } from "next/navigation";
import { authOptions } from "../../lib/AuthOptions";
import { getServerSession } from "next-auth";
import CidadaoPortal from "@/components/CidadaoPortal";

// 🔹 Garante que essa página nunca use cache
export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function CidadaoPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <CidadaoPortal
      pacienteId={session.user.id}
      pacienteNome={session.user.name || "Cidadão"}
      isMonitored={!!session.user.is_monitored}
      sessionServer={session}
    />
  );
}
