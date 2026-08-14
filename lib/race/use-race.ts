"use client";

import { useCallback, useEffect, useState } from "react";
import type { RaceAction, RaceCommand, RacePlayer, RaceSnapshot } from "./types";

// Client side of the race protocol: snapshots down an EventSource, commands up
// as plain POSTs.

export type RaceConnection = {
  snapshot: RaceSnapshot | null;
  me: RacePlayer | null;
  playerId: string | null;
  /** false while the stream is down; EventSource reconnects on its own */
  live: boolean;
  error: string | null;
  send: (command: RaceCommand) => void;
};

// sessionStorage: survives a reload but not a new tab, so two tabs on one
// machine can race each other (also how you test this)
function readPlayerId(roomId: string) {
  const key = `wpmlab:race:${roomId}:player`;
  let id = window.sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(key, id);
  }
  return id;
}

async function sendAction(roomId: string, action: RaceAction, onError: (message: string) => void) {
  try {
    const response = await fetch(`/api/race/${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      onError(body?.error ?? "race error");
    }
  } catch {
    // dropped progress pings don't matter — the next tick replaces them, and a
    // real outage already shows through the stream state
  }
}

export function useRace(roomId: string, name: string): RaceConnection {
  const [snapshot, setSnapshot] = useState<RaceSnapshot | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // lazy init: null on the server, real on the client. safe — no snapshot has
  // arrived at hydration time, so nothing derived from it is in the markup.
  const [playerId] = useState<string | null>(() => (typeof window === "undefined" ? null : readPlayerId(roomId)));

  const send = useCallback(
    (command: RaceCommand) => {
      if (!playerId) return;
      void sendAction(roomId, { ...command, playerId } as RaceAction, setError);
    },
    [roomId, playerId],
  );

  useEffect(() => {
    if (!name || !playerId) return;

    const source = new EventSource(`/api/race/${roomId}/stream?playerId=${encodeURIComponent(playerId)}`);

    source.onopen = () => {
      setLive(true);
      setError(null);
    };

    source.onmessage = (event) => {
      setSnapshot(JSON.parse(event.data) as RaceSnapshot);
      setLive(true);
    };

    source.onerror = () => {
      // EventSource retries by itself; this just drives the offline badge
      setLive(false);
    };

    // join after opening the stream so we don't miss the resulting broadcast
    void sendAction(roomId, { type: "join", playerId, name }, setError);

    return () => source.close();
  }, [roomId, name, playerId]);

  const me = snapshot?.players.find((p) => p.id === playerId) ?? null;

  // spectator whose join was rejected mid-race: claim a seat the moment the
  // room is back in a lobby, no re-click needed
  const inLobbyWithoutSeat = snapshot?.status === "lobby" && me === null;
  useEffect(() => {
    if (!inLobbyWithoutSeat || !name || !playerId) return;
    void sendAction(roomId, { type: "join", playerId, name }, setError);
  }, [inLobbyWithoutSeat, name, playerId, roomId]);

  return { snapshot, me, playerId, live, error, send };
}
