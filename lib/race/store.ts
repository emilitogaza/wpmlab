import { DEFAULT_CONFIG, sanitizeConfig, type TestConfig } from "@/lib/config";
import { totalChars } from "@/lib/engine";
import { generateWords, randomSeed } from "@/lib/words";
import {
  COUNTDOWN_MS,
  GRACE_MS,
  MAX_PLAYERS,
  type RaceAction,
  type RacePlayer,
  type RacePlayerResult,
  type RaceSnapshot,
  type RaceStatus,
  TICK_HZ,
} from "./types";

// Room registry. Server only — never import from a client component.
//
// Rooms live in this process's memory, so the app must run as ONE long-lived
// instance (`next start`, a container). Serverless fan-out puts players in
// different memories and they never see each other. Everything goes through
// applyAction, so swapping in Redis / a Durable Object is a contained change.

type Subscriber = {
  playerId: string;
  send: (snapshot: RaceSnapshot) => void;
};

type Room = {
  id: string;
  hostId: string | null;
  config: TestConfig;
  seed: number;
  /** cached — deriving it means regenerating the whole word list */
  totalChars: number;
  status: RaceStatus;
  /** server epoch ms; only ever sent to clients as a relative duration */
  startAt: number | null;
  players: Map<string, RacePlayer>;
  subscribers: Set<Subscriber>;
  ticker: ReturnType<typeof setInterval> | null;
  countdownTimer: ReturnType<typeof setTimeout> | null;
  /** server epoch ms; only ever sent as a relative duration */
  graceEndsAt: number | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
  lastActivity: number;
};

// hang the registry off globalThis so HMR module re-evals don't drop the rooms
const globalStore = globalThis as typeof globalThis & {
  __wpmlabRooms?: Map<string, Room>;
  __wpmlabReaper?: ReturnType<typeof setInterval>;
};

if (!globalStore.__wpmlabRooms) globalStore.__wpmlabRooms = new Map();
const rooms: Map<string, Room> = globalStore.__wpmlabRooms;

const ROOM_TTL_MS = 60 * 60 * 1000;
const REAP_INTERVAL_MS = 5 * 60 * 1000;

// the create endpoint is unauthenticated — cap rooms so a scripted loop gets
// 503s instead of exhausting memory
const MAX_ROOMS = 500;

/** streams per room: five racers plus some spectators */
const MAX_SUBSCRIBERS = 25;

if (!globalStore.__wpmlabReaper) {
  globalStore.__wpmlabReaper = setInterval(() => {
    const cutoff = Date.now() - ROOM_TTL_MS;
    for (const [id, room] of rooms) {
      if (room.lastActivity < cutoff) {
        stopTimers(room);
        rooms.delete(id);
      }
    }
  }, REAP_INTERVAL_MS);
  // don't hold the process open just to reap empty rooms
  globalStore.__wpmlabReaper.unref?.();
}

/* -------------------------------------------------------------------------- */
/* Room lifecycle                                                              */
/* -------------------------------------------------------------------------- */

// no 0/O or 1/I/l, so a room code can be read out loud without ambiguity
const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

function newRoomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function computeTotalChars(config: TestConfig, seed: number) {
  return totalChars(generateWords(config, seed));
}

export function createRoom(): string | null {
  if (rooms.size >= MAX_ROOMS) return null;

  let id = newRoomId();
  while (rooms.has(id)) id = newRoomId();

  // races default to a fixed word count so everyone has the same finish line
  const config: TestConfig = { ...DEFAULT_CONFIG, mode: "words", wordCount: 25 };
  const seed = randomSeed();

  rooms.set(id, {
    id,
    hostId: null,
    config,
    seed,
    totalChars: computeTotalChars(config, seed),
    status: "lobby",
    startAt: null,
    players: new Map(),
    subscribers: new Set(),
    ticker: null,
    countdownTimer: null,
    graceEndsAt: null,
    graceTimer: null,
    lastActivity: Date.now(),
  });

  return id;
}

export function roomExists(id: string) {
  return rooms.has(id);
}

function stopTimers(room: Room) {
  if (room.ticker) clearInterval(room.ticker);
  if (room.countdownTimer) clearTimeout(room.countdownTimer);
  if (room.graceTimer) clearTimeout(room.graceTimer);
  room.ticker = null;
  room.countdownTimer = null;
  room.graceTimer = null;
}

/* -------------------------------------------------------------------------- */
/* Snapshots and broadcasting                                                  */
/* -------------------------------------------------------------------------- */

// mask everyone else's id behind a per-seat alias — a player's id is also
// their action credential, so leaking it would let anyone spoof anyone
function snapshotFor(room: Room, viewerId: string | null): RaceSnapshot {
  return {
    roomId: room.id,
    status: room.status,
    config: room.config,
    seed: room.seed,
    players: [...room.players.values()].map((p) => (p.id === viewerId ? p : { ...p, id: `seat-${p.colorIndex}` })),
    startInMs: room.startAt === null ? null : Math.max(0, room.startAt - Date.now()),
    totalChars: room.totalChars,
    graceInMs: room.graceEndsAt === null ? null : Math.max(0, room.graceEndsAt - Date.now()),
  };
}

function broadcast(room: Room) {
  for (const subscriber of room.subscribers) {
    subscriber.send(snapshotFor(room, subscriber.playerId));
  }
}

export function subscribe(roomId: string, subscriber: Subscriber): (() => void) | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  if (room.subscribers.size >= MAX_SUBSCRIBERS) return null;

  room.subscribers.add(subscriber);
  room.lastActivity = Date.now();

  // a reconnecting EventSource re-subscribes without re-joining, so a known
  // player's connected flag comes back here too
  const knownPlayer = room.players.get(subscriber.playerId);
  if (knownPlayer) {
    knownPlayer.connected = true;
    reassignHost(room);
  }

  // the ticker pauses when the room empties; a mid-race reconnect restarts it
  if (room.status === "racing" && !room.ticker) {
    room.ticker = setInterval(() => broadcast(room), 1000 / TICK_HZ);
  }

  subscriber.send(snapshotFor(room, subscriber.playerId));

  return () => {
    room.subscribers.delete(subscriber);
    const player = room.players.get(subscriber.playerId);
    if (player) {
      // keep the player so a reload gets their colour and result back
      player.connected = false;
      reassignHost(room);
      // a quitter mid-race can be the last thing blocking the finish
      settleIfDone(room);
    }

    // nobody listening — pause the ticker. one-shot timers (countdown, grace)
    // keep running so a briefly-disconnected reloader's race still starts and
    // ends on time.
    if (room.subscribers.size === 0 && room.ticker) {
      clearInterval(room.ticker);
      room.ticker = null;
    }

    broadcast(room);
  };
}

// if the host leaves, the next connected player inherits the start button
function reassignHost(room: Room) {
  const current = room.hostId ? room.players.get(room.hostId) : undefined;
  if (current?.connected) return;

  const next = [...room.players.values()].find((p) => p.connected);
  room.hostId = next?.id ?? null;
  for (const player of room.players.values()) player.isHost = player.id === room.hostId;
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

export type ActionResult = { ok: true } | { ok: false; error: string };

export function applyAction(roomId: string, action: RaceAction): ActionResult {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, error: "room not found" };

  room.lastActivity = Date.now();

  switch (action.type) {
    case "join":
      return join(room, action.playerId, action.name);

    case "config": {
      if (room.hostId !== action.playerId) return { ok: false, error: "only the host can change the config" };
      if (room.status !== "lobby") return { ok: false, error: "race already started" };
      const config = sanitizeConfig(action.config);
      if (!config) return { ok: false, error: "invalid config" };
      room.config = config;
      // new config means new text, so the seed moves with it
      room.seed = randomSeed();
      room.totalChars = computeTotalChars(room.config, room.seed);
      broadcast(room);
      return { ok: true };
    }

    case "start": {
      if (room.hostId !== action.playerId) return { ok: false, error: "only the host can start" };
      if (room.status !== "lobby") return { ok: false, error: "race already started" };
      return start(room);
    }

    case "progress": {
      const player = room.players.get(action.playerId);
      if (!player) return { ok: false, error: "not in this room" };
      // straight off the wire — clamp, don't trust
      player.cursor = clampNumber(action.cursor, 0, room.totalChars);
      player.wpm = clampNumber(action.wpm, 0, 400);
      player.accuracy = clampNumber(action.accuracy, 0, 100);
      // no broadcast — the ticker coalesces updates into one message per tick
      return { ok: true };
    }

    case "finish": {
      const player = room.players.get(action.playerId);
      if (!player) return { ok: false, error: "not in this room" };

      // a force-finished player has a time but no result; if their own report
      // turns up late, take it — a real partial score beats a dash
      if (player.finishedAt !== null && player.result !== null) return { ok: true };

      if (room.startAt === null) return { ok: false, error: "race never started" };

      if (player.finishedAt === null) {
        player.finishedAt = Date.now() - room.startAt;
      }
      player.result = sanitizeResult(action.result, room, player.finishedAt);
      player.wpm = player.result.wpm;
      player.accuracy = player.result.accuracy;

      if (!settleIfDone(room)) startGrace(room);

      broadcast(room);
      return { ok: true };
    }

    case "rematch": {
      if (!room.players.has(action.playerId)) return { ok: false, error: "not in this room" };
      if (room.status !== "finished") return { ok: false, error: "race still running" };
      stopTimers(room);
      room.status = "lobby";
      room.startAt = null;
      room.graceEndsAt = null;
      room.seed = randomSeed();
      room.totalChars = computeTotalChars(room.config, room.seed);
      for (const player of room.players.values()) resetPlayer(player);
      broadcast(room);
      return { ok: true };
    }

    case "leave": {
      room.players.delete(action.playerId);
      reassignHost(room);
      broadcast(room);
      return { ok: true };
    }

    // easter egg: typing "make me win" mid-race ends the round with the typist
    // on top at 1337 wpm. skips sanitizeResult — the impossible number is the joke.
    case "cheat": {
      const player = room.players.get(action.playerId);
      if (!player) return { ok: false, error: "not in this room" };
      if (room.status !== "racing" || room.startAt === null) return { ok: false, error: "no race to win" };

      const elapsed = Date.now() - room.startAt;

      player.finishedAt = 1; // ahead of any honest finish
      player.cursor = room.totalChars;
      player.wpm = 1337;
      player.accuracy = 100;
      player.result = {
        wpm: 1337,
        rawWpm: 1337,
        accuracy: 100,
        consistency: 100,
        durationMs: elapsed,
        samples: [],
      };

      // stamp everyone else done; their clients flush real partial scores
      for (const p of room.players.values()) {
        if (p.finishedAt === null) p.finishedAt = elapsed;
      }

      room.status = "finished";
      room.graceEndsAt = null;
      stopTimers(room);
      broadcast(room);
      return { ok: true };
    }
  }
}

// non-numeric input becomes min instead of NaN leaking into the standings
function clampNumber(value: unknown, min: number, max: number) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, n));
}

// results are client-computed and therefore forgeable. clamp wpm to the best
// possible honest speed for this text length and elapsed time, plus some slack
// for clock skew and POST latency.
function sanitizeResult(input: RacePlayerResult, room: Room, finishedAtMs: number): RacePlayerResult {
  const elapsedMinutes = Math.max(finishedAtMs, 1000) / 60_000;
  const maxWpm = (room.totalChars / 5 / elapsedMinutes) * 1.2 + 5;

  const samples = Array.isArray(input?.samples)
    ? input.samples.slice(0, 600).map((sample) => ({
        second: clampNumber(sample?.second, 0, 100_000),
        wpm: clampNumber(sample?.wpm, 0, maxWpm),
        raw: clampNumber(sample?.raw, 0, maxWpm * 2),
        errors: clampNumber(sample?.errors, 0, 100),
      }))
    : [];

  return {
    wpm: clampNumber(input?.wpm, 0, maxWpm),
    rawWpm: clampNumber(input?.rawWpm, 0, maxWpm * 2),
    accuracy: clampNumber(input?.accuracy, 0, 100),
    consistency: clampNumber(input?.consistency, 0, 100),
    durationMs: clampNumber(input?.durationMs, 0, finishedAtMs + 5000),
    samples,
  };
}

function resetPlayer(player: RacePlayer) {
  player.cursor = 0;
  player.wpm = 0;
  player.accuracy = 100;
  player.finishedAt = null;
  player.result = null;
}

// end the race if everyone still connected is done — disconnected players
// never block the finish. returns whether it settled.
function settleIfDone(room: Room): boolean {
  if (room.status !== "racing" && room.status !== "countdown") return room.status === "finished";

  const active = [...room.players.values()].filter((p) => p.connected);
  if (active.length === 0 || !active.every((p) => p.finishedAt !== null)) return false;

  room.status = "finished";
  room.graceEndsAt = null;
  stopTimers(room);
  return true;
}

// idempotent: later finishers don't extend the grace window
function startGrace(room: Room) {
  if (room.status !== "racing" || room.graceEndsAt !== null) return;

  room.graceEndsAt = Date.now() + GRACE_MS;

  room.graceTimer = setTimeout(() => {
    // backstop for gone/frozen tabs — clients finish themselves on the same
    // deadline and report a real partial score
    for (const player of room.players.values()) {
      if (player.finishedAt === null) player.finishedAt = room.startAt ? Date.now() - room.startAt : GRACE_MS;
    }

    room.status = "finished";
    room.graceEndsAt = null;
    stopTimers(room);
    broadcast(room);
  }, GRACE_MS);
}

function join(room: Room, playerId: string, name: string): ActionResult {
  const existing = room.players.get(playerId);

  if (existing) {
    // a reload, not a new player — keep the colour and any finished result
    existing.connected = true;
    existing.name = name.slice(0, 16) || existing.name;
    reassignHost(room);
    broadcast(room);
    return { ok: true };
  }

  if (room.players.size >= MAX_PLAYERS) return { ok: false, error: "race is full" };
  if (room.status !== "lobby") return { ok: false, error: "race already started" };

  const taken = new Set([...room.players.values()].map((p) => p.colorIndex));
  let colorIndex = 0;
  while (taken.has(colorIndex)) colorIndex++;

  room.players.set(playerId, {
    id: playerId,
    name: name.slice(0, 16) || `player ${room.players.size + 1}`,
    colorIndex,
    isHost: false,
    connected: true,
    cursor: 0,
    wpm: 0,
    accuracy: 100,
    finishedAt: null,
    result: null,
  });

  reassignHost(room);
  broadcast(room);
  return { ok: true };
}

function start(room: Room): ActionResult {
  const ready = [...room.players.values()].filter((p) => p.connected);
  if (ready.length === 0) return { ok: false, error: "nobody here" };

  for (const player of room.players.values()) resetPlayer(player);

  room.status = "countdown";
  room.startAt = Date.now() + COUNTDOWN_MS;
  broadcast(room);

  room.countdownTimer = setTimeout(() => {
    room.status = "racing";
    broadcast(room);

    // only tick while someone is listening; subscribe() restarts it otherwise
    if (room.subscribers.size > 0) {
      room.ticker = setInterval(() => broadcast(room), 1000 / TICK_HZ);
    }
  }, COUNTDOWN_MS);

  return { ok: true };
}

export function getSnapshot(roomId: string): RaceSnapshot | null {
  const room = rooms.get(roomId);
  return room ? snapshotFor(room, null) : null;
}
