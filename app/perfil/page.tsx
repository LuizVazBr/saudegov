import ClientPerfil from "@/components/ClientPerfil";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import { redirect } from "next/navigation"; // ✅ IMPORTAR redirect

export default async function ConfiguracoesPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    // Se não tiver sessão, redireciona para login
    return redirect("/login");
  }

  return <ClientPerfil sessionServer={session} />;
}
