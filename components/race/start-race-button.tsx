"use client";

import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** creates a room and drops you into its lobby */
export function StartRaceButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const response = await fetch("/api/race", { method: "POST" });
            if (!response.ok) throw new Error("could not create a race");
            const { roomId } = (await response.json()) as { roomId: string };
            router.push(`/race/${roomId}`);
          } catch {
            setError("could not start a race");
            setBusy(false);
          }
        }}
        className="inline-flex cursor-pointer items-center gap-2 rounded-2 px-3 py-1.5 text-ink-faint text-sm transition-colors hover:bg-fill-muted hover:text-ink disabled:opacity-50"
      >
        <Users className="icon-4" />
        {busy ? "starting…" : "race a friend"}
      </button>
      {error && <span className="text-error-ink text-xs">{error}</span>}
    </div>
  );
}
