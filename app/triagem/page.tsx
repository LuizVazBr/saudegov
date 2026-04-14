// src/app/triagem/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/AuthOptions";
import { redirect } from "next/navigation";
import TriagemApp from "../../components/TriagemApp";
import type { Session } from "next-auth";

export default async function Triagem() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");

  if (session.user.tipo_usuario?.toLowerCase() !== "enfermeiro") {
    // Se não for enfermeiro, redireciona para home
    redirect("/");
  }

  return (
    <TriagemApp
      enfermeiroId={session.user.id}
      enfermeiroNome={session.user.name || "Enfermeiro"}
      sessionServer={session}
    />
  );

}
