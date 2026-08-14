"use client";

import { RotateCcw } from "lucide-react";
import { RaceChart } from "@/components/race/race-chart";
import { describeConfig } from "@/lib/config";
import { type RacePlayer, type RaceSnapshot, raceColorBg, raceColorText, rankPlayers } from "@/lib/race/types";
import { cn } from "@/lib/utils";

export function RaceResults({
  snapshot,
  meId,
  canRematch,
  onRematch,
}: {
  snapshot: RaceSnapshot;
  meId: string | null;
  /** Spectators see the board, but the rematch belongs to the racers. */
  canRematch: boolean;
  onRematch: () => void;
}) {
  const ranked = rankPlayers(snapshot.players);
  const stillGoing = snapshot.players.some((p) => p.connected && p.finishedAt === null);

  return (
    <div className="flex w-full max-w-4xl flex-col gap-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl">results</h1>
        <span className="font-mono text-ink-faint text-sm">{describeConfig(snapshot.config)}</span>
      </div>

      <ol className="flex flex-col gap-2">
        {ranked.map((player, index) => (
          <Row key={player.id} player={player} position={index + 1} isMe={player.id === meId} />
        ))}
      </ol>

      {stillGoing && <p className="font-mono text-ink-faint text-sm">still racing — this fills in as they finish</p>}

      <RaceChart players={snapshot.players} />

      <div className="flex justify-center">
        {canRematch ? (
          <button
            type="button"
            onClick={onRematch}
            disabled={stillGoing}
            className="inline-flex cursor-pointer items-center gap-2 rounded-2 bg-brand-fill px-5 py-2.5 font-mono text-brand-ink-flip text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="icon-4" />
            rematch
          </button>
        ) : (
          <p className="font-mono text-ink-dim text-sm">when they go again, you&apos;re in — hang tight</p>
        )}
      </div>
    </div>
  );
}

function Row({ player, position, isMe }: { player: RacePlayer; position: number; isMe: boolean }) {
  const result = player.result;

  return (
    <li
      className={cn(
        "grid grid-cols-[2rem_1fr_auto] items-center gap-4 rounded-2 px-4 py-3 sm:grid-cols-[2rem_1fr_repeat(4,5rem)]",
        isMe ? "bg-fill-muted" : "bg-fill-raised",
      )}
    >
      <span className="font-mono text-ink-faint text-sm tabular-nums">{position}</span>

      <span className="flex min-w-0 items-center gap-2">
        <span className={cn("size-2.5 shrink-0 rounded-full", raceColorBg(player.colorIndex))} />
        <span className={cn("truncate font-mono text-sm", raceColorText(player.colorIndex))}>{player.name}</span>
        {isMe && <span className="font-mono text-ink-faint text-xs">you</span>}
      </span>

      <Cell label="wpm" value={result ? Math.round(result.wpm) : "—"} strong />
      <Cell label="acc" value={result ? `${Math.round(result.accuracy)}%` : "—"} />
      <Cell label="raw" value={result ? Math.round(result.rawWpm) : "—"} />
      <Cell label="time" value={result ? `${(result.durationMs / 1000).toFixed(1)}s` : "—"} />
    </li>
  );
}

function Cell({ label, value, strong }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <span className="hidden text-right sm:block">
      <span className="block font-mono text-[0.625rem] text-ink-faint">{label}</span>
      <span className={cn("block font-mono tabular-nums", strong ? "text-ink text-lg" : "text-ink-dim text-sm")}>
        {value}
      </span>
    </span>
  );
}
