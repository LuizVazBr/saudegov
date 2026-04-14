import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import ClientExames from "./ClientExames";

export default async function ExamesPage() {
    const session = await getServerSession(authOptions);

    return <ClientExames sessionServer={session} />;
}
