import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import ClientCondicoes from "./ClientCondicoes";

export default async function CondicoesPage() {
  const session = await getServerSession(authOptions);

  return <ClientCondicoes sessionServer={session} />;
}
