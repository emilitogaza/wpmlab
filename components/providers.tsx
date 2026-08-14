"use client";

import { domAnimation, LazyMotion } from "motion/react";
import { ThemeProvider } from "next-themes";
import { SettingsProvider } from "@/components/settings-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* Loaded once here so every component can use the tiny `m` components.
          `strict` makes the full `motion.*` components throw, which is the
          point: it stops anyone from silently pulling in the big bundle. */}
      <LazyMotion features={domAnimation} strict>
        <SettingsProvider>{children}</SettingsProvider>
      </LazyMotion>
    </ThemeProvider>
  );
}
