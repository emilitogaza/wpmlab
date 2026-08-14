"use client";

import { useState } from "react";
import { SettingsDialog } from "@/components/settings-dialog";
import { SiteHeader } from "@/components/site-header";
import { TypingTest } from "@/components/typing-test";

// Owns the one piece of shared state: while the settings dialog is open the
// test must stop swallowing keystrokes.
export function TypingApp() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-16 px-6 py-6">
      <SiteHeader onOpenSettings={() => setSettingsOpen(true)} />

      <main className="flex flex-1 flex-col items-center justify-center pb-24">
        <TypingTest settingsOpen={settingsOpen} />
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
