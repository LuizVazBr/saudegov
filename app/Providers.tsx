"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "../components/ThemeProvider";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>{children}</ThemeProvider>
      <Toaster richColors position="top-center" />
    </SessionProvider>
  );
}
