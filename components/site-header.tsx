"use client";

import { Keyboard, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { IconButton } from "@/components/ui/icon-button";

export function SiteHeader({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <header className="flex w-full items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <Keyboard className="icon-7 text-brand-ink" />
        <div className="leading-none">
          <span className="block font-stretch-120% text-2xl">wpmlab</span>
          <span className="block text-[0.625rem] text-ink-faint">type fast like a gremlin</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <IconButton onClick={onOpenSettings} aria-label="Settings" title="Settings">
          <Settings className="icon-4" />
        </IconButton>
        <ThemeToggle />
      </div>
    </header>
  );
}
