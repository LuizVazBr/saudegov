import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/AuthOptions";
import { redirect } from "next/navigation";
import Dashboard from "../../components/Dashboard";
import type { Session } from "next-auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");

  if (session.user.tipo_usuario?.toLowerCase() !== "gestor") {
    redirect("/");
  }

  return (
    <Dashboard
      enfermeiroId={session.user.id}
      enfermeiroNome={session.user.name || "Gestor"}
      sessionServer={session}
    />
  );
}
