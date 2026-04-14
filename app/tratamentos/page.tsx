import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/AuthOptions";
import ClientTratamentos from "./ClientTratamentos";

export default async function Tratamentos() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <ClientTratamentos sessionServer={session} />;
}
