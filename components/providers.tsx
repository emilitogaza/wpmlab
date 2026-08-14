"use client";

import { domAnimation, LazyMotion } from "motion/react";
import { ThemeProvider } from "next-themes";
import { SettingsProvider } from "@/components/settings-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* loaded once; strict makes the full motion.* components throw so
          nobody silently pulls in the big bundle */}
      <LazyMotion features={domAnimation} strict>
        <SettingsProvider>{children}</SettingsProvider>
      </LazyMotion>
    </ThemeProvider>
  );
}
