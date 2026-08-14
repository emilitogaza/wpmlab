"use client";

import { m } from "motion/react";
import { type RacePlayer, raceColorBg, raceColorText, rankPlayers } from "@/lib/race/types";
import { cn } from "@/lib/utils";

// One track per player, filled to their position in the text. Your own row is
// driven by local state so it moves with your fingers instead of lagging a
// round-trip behind them.
export function Standings({
  players,
  totalChars,
  meId,
  local,
}: {
  players: RacePlayer[];
  totalChars: number;
  meId: string | null;
  /** your own position and speed, straight from the local engine */
  local?: { cursor: number; wpm: number };
}) {
  const merged = players.map((player) =>
    player.id === meId && local && player.finishedAt === null
      ? { ...player, cursor: local.cursor, wpm: local.wpm }
      : player,
  );

  return (
    <ul className="flex w-full flex-col gap-2">
      {rankPlayers(merged).map((player) => {
        const isMe = player.id === meId;
        const ratio = totalChars > 0 ? Math.min(1, player.cursor / totalChars) : 0;

        return (
          <li key={player.id} className="flex items-center gap-3">
            <span
              className={cn(
                "w-28 shrink-0 truncate text-sm",
                raceColorText(player.colorIndex),
                !player.connected && "opacity-40",
              )}
            >
              {player.name}
              {isMe && <span className="text-ink-faint"> (you)</span>}
            </span>

            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-fill-muted">
              <m.div
                initial={false}
                animate={{ scaleX: ratio }}
                // own bar snaps (exact, per-keystroke); rivals get a spring to
                // smooth their 10Hz updates
                transition={isMe ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 34 }}
                style={{ transformOrigin: "left" }}
                className={cn("absolute inset-0 rounded-full", raceColorBg(player.colorIndex))}
              />
            </div>

            <span className="w-24 shrink-0 text-right text-ink-dim text-sm">
              {player.finishedAt !== null ? (
                <span className="text-ink">{`${Math.round(player.wpm)} wpm`}</span>
              ) : (
                `${Math.round(player.wpm)} wpm`
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
