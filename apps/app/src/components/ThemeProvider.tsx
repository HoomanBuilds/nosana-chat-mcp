"use client";

import { ReactNode, useEffect, useState } from "react";
import { useSettingsStore } from "@/store/setting.store";
import { LazyMotion, domAnimation } from "motion/react";

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const appearance = useSettingsStore((state) => state.localConfig.appearance);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    if (appearance === "dark") {
      html.classList.add("dark");
      html.classList.remove("light");
    } else {
      html.classList.add("light");
      html.classList.remove("dark");
    }
  }, [appearance, mounted]);

  if (!mounted) {
    return (
      <div style={{ visibility: "hidden" }} aria-hidden="true">
        {children}
      </div>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      {children}
    </LazyMotion>
  );
}
