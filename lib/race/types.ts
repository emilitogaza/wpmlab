import type { TestConfig } from "@/lib/config";
import type { Sample } from "@/lib/stats";

// Race wire protocol, shared by the route handlers and the client hook. The
// test text is never sent — both sides generate it from config + seed.

export const MAX_PLAYERS = 5;

export const COUNTDOWN_MS = 5000;

/** broadcast rate — smooth enough for carets, 5 players ≈ 50 msg/s */
export const TICK_HZ = 10;

/** how long the rest of the field gets once the first player finishes */
export const GRACE_MS = 15_000;

export type RaceStatus = "lobby" | "countdown" | "racing" | "finished";

export type RacePlayerResult = {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  durationMs: number;
  samples: Sample[];
};

export type RacePlayer = {
  /** real only for the receiving player; everyone else's is masked to a seat
   *  alias — the real id doubles as the action credential */
  id: string;
  name: string;
  /** slot in the five-colour palette, held for the life of the room */
  colorIndex: number;
  isHost: boolean;
  connected: boolean;
  /** char index into the flattened test text */
  cursor: number;
  wpm: number;
  accuracy: number;
  /** ms from race start to finishing; null while still going */
  finishedAt: number | null;
  result: RacePlayerResult | null;
};

export type RaceSnapshot = {
  roomId: string;
  status: RaceStatus;
  config: TestConfig;
  seed: number;
  players: RacePlayer[];
  /** ms until the race starts, recomputed at send time. relative on purpose —
   *  wall clocks disagree, an absolute instant would need clock sync */
  startInMs: number | null;
  /** length of the flattened test text, for turning a cursor into a ratio */
  totalChars: number;
  /** ms left on the grace clock, or null; relative for the same reason */
  graceInMs: number | null;
};

// A command without the player id. Kept as its own union — Omit<RaceAction,
// "playerId"> would collapse it to the shared keys and lose the payloads.
export type RaceCommand =
  | { type: "join"; name: string }
  | { type: "config"; config: TestConfig }
  | { type: "start" }
  | { type: "progress"; cursor: number; wpm: number; accuracy: number }
  | { type: "finish"; result: RacePlayerResult }
  | { type: "rematch" }
  | { type: "leave" }
  /** easter egg: the client saw "make me win" typed mid-race */
  | { type: "cheat" };

export type RaceAction = RaceCommand & { playerId: string };

// slot 0 is the brand purple, the rest are the rival hues
export const RACE_COLOR_TEXT = ["text-brand-ink", "text-rival-1", "text-rival-2", "text-rival-3", "text-rival-4"];
export const RACE_COLOR_BG = ["bg-brand-fill", "bg-rival-1", "bg-rival-2", "bg-rival-3", "bg-rival-4"];
export const RACE_COLOR_STROKE = [
  "stroke-series-wpm",
  "stroke-rival-1",
  "stroke-rival-2",
  "stroke-rival-3",
  "stroke-rival-4",
];

export function raceColorText(index: number) {
  return RACE_COLOR_TEXT[index % RACE_COLOR_TEXT.length];
}

export function raceColorBg(index: number) {
  return RACE_COLOR_BG[index % RACE_COLOR_BG.length];
}

export function raceColorStroke(index: number) {
  return RACE_COLOR_STROKE[index % RACE_COLOR_STROKE.length];
}

// finishers by time, then everyone else by progress. same comparator for the
// live standings and the final board, so positions don't reshuffle at the end
export function rankPlayers(players: RacePlayer[]): RacePlayer[] {
  return [...players].sort((a, b) => {
    if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt;
    if (a.finishedAt !== null) return -1;
    if (b.finishedAt !== null) return 1;
    return b.cursor - a.cursor;
  });
}
