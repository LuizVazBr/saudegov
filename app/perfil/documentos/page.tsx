import ClientDocumentos from "@/components/ClientDocumentos";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import { redirect } from "next/navigation";

export default async function DocumentosPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return redirect("/login");
  }

  return <ClientDocumentos sessionServer={session} />;
}
