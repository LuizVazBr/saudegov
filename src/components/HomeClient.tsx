"use client";

import ClientApp from "./ClientApp";
import { Session } from "next-auth";

interface HomeClientProps {
  pacienteId: string;
  pacienteNome: string;
  isMonitored: boolean;
  sessionServer?: Session;
}

export default function HomeClient({ pacienteId, pacienteNome, isMonitored, sessionServer }: HomeClientProps) {
  return (
    <ClientApp
      pacienteId={pacienteId}
      pacienteNome={pacienteNome}
      sessionServer={sessionServer}
      isMonitored={isMonitored}
    />
  );
}
