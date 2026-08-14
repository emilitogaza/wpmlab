"use client";

import { Check, Copy, Crown, Play } from "lucide-react";
import { useState } from "react";
import { ConfigBar } from "@/components/config-bar";
import type { TestConfig } from "@/lib/config";
import { MAX_PLAYERS, type RacePlayer, raceColorBg, raceColorText } from "@/lib/race/types";
import { cn } from "@/lib/utils";

export function Lobby({
  roomId,
  players,
  config,
  isHost,
  meId,
  onConfigChange,
  onStart,
}: {
  roomId: string;
  players: RacePlayer[];
  config: TestConfig;
  isHost: boolean;
  meId: string | null;
  onConfigChange: (patch: Partial<TestConfig>) => void;
  onStart: () => void;
}) {
  const connected = players.filter((p) => p.connected);

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-3xl">race lobby</h1>
        <ShareLink roomId={roomId} />
      </div>

      <ul className="flex w-full flex-col gap-2">
        {players.map((player) => (
          <li
            key={player.id}
            className={cn(
              "flex items-center gap-3 rounded-2 bg-fill-raised px-4 py-3",
              !player.connected && "opacity-40",
            )}
          >
            <span className={cn("size-3 shrink-0 rounded-full", raceColorBg(player.colorIndex))} />
            <span className={cn("text-sm", raceColorText(player.colorIndex))}>{player.name}</span>
            {player.id === meId && <span className="text-ink-faint text-xs">you</span>}
            {player.isHost && <Crown className="icon-3.5 text-ink-faint" aria-label="host" />}
            {!player.connected && <span className="ml-auto text-ink-faint text-xs">offline</span>}
          </li>
        ))}

        {/* empty seats, keyed by slot number */}
        {Array.from({ length: Math.max(0, MAX_PLAYERS - players.length) }, (_, i) => players.length + i).map((slot) => (
          <li
            key={`seat-${slot}`}
            className="rounded-2 border border-border border-dashed px-4 py-3 text-ink-faint text-sm"
          >
            waiting for a player…
          </li>
        ))}
      </ul>

      {isHost ? (
        <div className="flex w-full flex-col items-center gap-6">
          <ConfigBar config={config} onChange={onConfigChange} hidden={false} />
          <button
            type="button"
            onClick={onStart}
            disabled={connected.length === 0}
            className="inline-flex cursor-pointer items-center gap-2 rounded-2 bg-brand-fill px-5 py-2.5 text-brand-ink-flip text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="icon-4" />
            start race
          </button>
          {connected.length === 1 && (
            <p className="text-ink-faint text-xs">you can start solo, but it is more fun with company</p>
          )}
        </div>
      ) : (
        <p className="text-ink-dim text-sm">waiting for the host to start…</p>
      )}
    </div>
  );
}

function ShareLink({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);

  // built from the live location so the link works on localhost, LAN, and a
  // deployment alike
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/race/${roomId}`;

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // clipboard denied — the link is on screen to copy by hand
        }
      }}
      className="flex cursor-pointer items-center gap-2 rounded-2 bg-fill-raised px-3 py-2 text-ink-dim text-sm transition-colors hover:bg-fill-muted hover:text-ink"
    >
      {copied ? <Check className="icon-4 text-brand-ink" /> : <Copy className="icon-4" />}
      <span className="max-w-[22rem] truncate">{url || `/race/${roomId}`}</span>
    </button>
  );
}
