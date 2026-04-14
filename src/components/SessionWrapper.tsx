"use client";

import { SessionProvider } from "next-auth/react";

export default function SessionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={10} refetchOnWindowFocus>
      {children}
    </SessionProvider>
  );
}
