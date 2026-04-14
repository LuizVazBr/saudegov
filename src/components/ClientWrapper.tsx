"use client";

import { useEffect, useState } from "react";
import { Providers } from "@/app/Providers";
import Loader from "@/components/Loader";
import { useTheme } from "@/components/ThemeProvider";

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const { themeName } = useTheme(); // ✅ pega do ThemeProvider
  const isDark = themeName === "dark";

  useEffect(() => {
    // Splash inicial rápido, o ClientApp cuida do sincronismo real
    const timer = setTimeout(() => {
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return loading ? <Loader isDark={isDark} /> : <Providers>{children}</Providers>;
}
