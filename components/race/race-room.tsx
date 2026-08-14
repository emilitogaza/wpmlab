"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Lobby } from "@/components/race/lobby";
import { RaceResults } from "@/components/race/race-results";
import { RaceTest } from "@/components/race/race-test";
import { Spectate } from "@/components/race/spectate";
import { SettingsDialog } from "@/components/settings-dialog";
import { useSettings } from "@/components/settings-provider";
import { SiteHeader } from "@/components/site-header";
import type { TestConfig } from "@/lib/config";
import { useRace } from "@/lib/race/use-race";

// Name gate, then whichever view the room's status calls for. The room is the
// source of truth — this component holds no race state of its own.
export function RaceRoom({ roomId }: { roomId: string }) {
  const { settings, setSetting } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { snapshot, me, playerId, live, error, send } = useRace(roomId, settings.playerName);

  const onConfigChange = useCallback(
    (patch: Partial<TestConfig>) => {
      if (!snapshot) return;
      send({ type: "config", config: { ...snapshot.config, ...patch } });
    },
    [snapshot, send],
  );

  // racer vs spectator: you race only if this tab saw the lobby before the
  // round began; arriving or reloading mid-race means spectating until the
  // next lobby. adjusted during render (not an effect) so the first racing
  // snapshot can't flash the wrong view.
  const [participating, setParticipating] = useState(false);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  const status = snapshot?.status ?? null;
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status === "lobby") setParticipating(true);
  }

  // if the server settles before our own result lands, swapping straight to
  // results would unmount RaceTest before it can report — hold the race view
  // until our result shows up in the snapshot, with a short cap as backstop.
  // keyed per seed: a rematch deals a new seed and invalidates it naturally.
  const [holdExpiredForSeed, setHoldExpiredForSeed] = useState<number | null>(null);
  const awaitingOwnResult =
    participating &&
    snapshot?.status === "finished" &&
    me !== null &&
    me.connected &&
    me.result === null &&
    holdExpiredForSeed !== snapshot.seed;

  useEffect(() => {
    if (!awaitingOwnResult || !snapshot) return;
    const seed = snapshot.seed;
    const id = window.setTimeout(() => setHoldExpiredForSeed(seed), 2500);
    return () => window.clearTimeout(id);
  }, [awaitingOwnResult, snapshot]);

  // "race already started" just means we're spectating, not an error
  const shownError = error === "race already started" ? null : error;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-12 px-6 py-6">
      <SiteHeader onOpenSettings={() => setSettingsOpen(true)} />

      <main className="flex flex-1 flex-col items-center justify-center pb-16">
        {!settings.playerName ? (
          <NameGate onSubmit={(name) => setSetting("playerName", name)} />
        ) : !snapshot ? (
          <Status>{error ?? "joining the race…"}</Status>
        ) : snapshot.status === "lobby" ? (
          <Lobby
            roomId={roomId}
            players={snapshot.players}
            config={snapshot.config}
            isHost={me?.isHost ?? false}
            meId={playerId}
            onConfigChange={onConfigChange}
            onStart={() => send({ type: "start" })}
          />
        ) : snapshot.status === "finished" && !awaitingOwnResult ? (
          <RaceResults
            snapshot={snapshot}
            meId={playerId}
            canRematch={me !== null}
            onRematch={() => send({ type: "rematch" })}
          />
        ) : participating && me !== null ? (
          <RaceTest snapshot={snapshot} meId={playerId} send={send} />
        ) : (
          <Spectate snapshot={snapshot} />
        )}

        {settings.playerName && !live && (
          <p className="mt-8 font-mono text-error-ink text-xs">connection lost — reconnecting…</p>
        )}
        {shownError && snapshot && <p className="mt-4 font-mono text-error-ink text-xs">{shownError}</p>}
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-mono text-ink-dim text-sm">{children}</p>
      <Link href="/" className="font-mono text-ink-faint text-xs underline-offset-4 hover:underline">
        back to solo
      </Link>
    </div>
  );
}

// name is stored with the settings — asked once, reused for every race
function NameGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const name = value.trim().slice(0, 16);
        if (name) onSubmit(name);
      }}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <label htmlFor="race-name" className="font-mono text-ink-dim text-sm">
        what should the others call you?
      </label>
      <input
        id="race-name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={16}
        autoComplete="off"
        // biome-ignore lint/a11y/noAutofocus: the only interactive element on the screen, and the user came here to type
        autoFocus
        placeholder="name"
        className="rounded-2 bg-fill-raised px-4 py-3 font-mono text-ink outline-none placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-brand/60"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="cursor-pointer rounded-2 bg-brand-fill px-4 py-2.5 font-mono text-brand-ink-flip text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        join race
      </button>
    </form>
  );
}
