// app/login/page.tsx
import LoginPageClient from "@/components/LoginPageClient"; // seu componente "client"
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  // Se já tiver uma sessão válida, fura o Nginx Cache redirecionando a partir
  // do Server Component raiz em vez de usar middlewares problemáticos
  if (session?.user) {
    const role = (session.user.tipo_usuario || "").toString().trim().toLowerCase();
    
    if (role === "enfermeiro") {
      redirect("/triagem");
    } else {
      redirect("/"); // Paciente / Gestor
    }
  }

  // Se não tiver sessão, renderiza a página de login
  return <LoginPageClient />;
}
