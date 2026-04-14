"use client";

import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from "next-themes";
import React, { createContext, useContext, ReactNode, useEffect, useState } from "react";

export interface Tema {
  mainBg: string;
  cardBg: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  progressBg: string;
  progressFill: string;
  badgeBg: string;
  linkColor: string;
  badgeText: string;
  btnBg: string;
  btnMap: string;
  btnHover: string;
  btnHoverMap: string;
  tabActive: string;
  tabInactive: string;
  toggleBg: string;
  toggleHoverBg: string;
  toastBg: string;
  toastText: string;
}


const temaClaro: Tema = {
  mainBg: "bg-gray-50",
  cardBg: "bg-white",
  borderColor: "border-gray-200",
  textPrimary: "text-black",
  textSecondary: "text-gray-700",
  progressBg: "bg-gray-200",
  progressFill: "bg-blue-400",
  badgeBg: "bg-blue-400",
  linkColor: "text-blue-500",
  badgeText: "text-white",
  btnBg: "bg-blue-600",
  btnMap: "bg-gray-200",
  btnHover: "hover:bg-blue-700",
  btnHoverMap: "hover:bg-gray-400",
  tabActive: "text-black border-b-2 border-blue-400",
  tabInactive: "text-gray-500",
  toggleBg: "bg-blue-100",
  toggleHoverBg: "hover:bg-blue-200",
  toastBg: "#fff",       // 🔥 define cor clara
  toastText: "#000"      // 🔥 define texto
};

const temaDarkSuave: Tema = {
  mainBg: "bg-gray-900",
  cardBg: "bg-gray-800",
  borderColor: "border-gray-700",
  textPrimary: "text-gray-200",
  textSecondary: "text-gray-400",
  progressBg: "bg-gray-700",
  progressFill: "bg-gray-500",
  badgeBg: "bg-gray-500",
  linkColor: "text-blue-300",
  badgeText: "text-white",
  btnBg: "bg-gray-600",
  btnMap: "bg-gray-200",
  btnHover: "hover:bg-gray-500",
  btnHoverMap: "hover:bg-gray-400",
  tabActive: "text-gray-400 border-b-2 border-gray-400",
  tabInactive: "text-gray-500",
  toggleBg: "bg-gray-800",
  toggleHoverBg: "hover:bg-gray-700",
  toastBg: "#333",       // 🔥 define cor dark
  toastText: "#fff"      // 🔥 define texto
};

interface ThemeContextProps {
  tema: Tema;
  themeName: string;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      tema: temaClaro,
      themeName: "light",
      toggleTheme: () => {},
    };
  }
  return context;
};

// Componente interno que só renderiza após montagem para evitar hydration mismatch
function ThemeProviderContent({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const temaAtual = resolvedTheme === "dark" ? temaDarkSuave : temaClaro;
  const themeName = resolvedTheme || "light";

  if (!mounted) return <div suppressHydrationWarning />;

  return (
    <ThemeContext.Provider value={{ tema: temaAtual, themeName, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="temaDark"
      enableColorScheme
    >
      <ThemeProviderContent>{children}</ThemeProviderContent>
    </NextThemesProvider>
  );
}
