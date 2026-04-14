import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/AuthOptions";
import ClientAgendamentos from "./ClientAgendamentos";

export default async function Agendamentos() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    return <ClientAgendamentos sessionServer={session} />;
}
