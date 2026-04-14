import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import { redirect } from "next/navigation";
import RealTimeDashboard from "@/components/RealTimeDashboard";

export default async function GestorDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.tipo_usuario !== "gestor") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <RealTimeDashboard user={session.user} />
    </div>
  );
}
