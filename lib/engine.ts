import type { TestConfig } from "./config";
import type { EngineRules } from "./settings";
import { generateWords } from "./words";

// Pure reducer over keystrokes. No DOM, no timers, no clock reads — `applyKey`
// takes an explicit timestamp, which keeps runs replayable and lets a race
// server verify results with the same code.

export type TestStatus = "idle" | "running" | "finished";

export type TestState = {
  readonly config: TestConfig;
  readonly rules: EngineRules;
  readonly seed: number;
  readonly words: string[];
  /** what the user typed, index-aligned with `words` (may overshoot the target) */
  readonly typed: string[];
  readonly wordIndex: number;
  readonly status: TestStatus;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
  /** all char-producing presses incl. rejected ones — accuracy denominator */
  readonly keypresses: number;
  /** timestamps of wrong presses — accuracy numerator + chart markers */
  readonly errorTimes: readonly number[];
};

export type KeyInput = { type: "char"; char: string } | { type: "space" } | { type: "backspace"; whole?: boolean };

// cap on trailing extra chars, so a stuck key can't grow the line forever
const MAX_EXTRA_CHARS = 12;

export function createTestState(config: TestConfig, rules: EngineRules, seed: number): TestState {
  const words = generateWords(config, seed);
  return {
    config,
    rules,
    seed,
    words,
    typed: new Array<string>(words.length).fill(""),
    wordIndex: 0,
    status: "idle",
    startedAt: null,
    endedAt: null,
    keypresses: 0,
    errorTimes: [],
  };
}

export function finishTest(state: TestState, at: number): TestState {
  if (state.status === "finished") return state;
  return { ...state, status: "finished", endedAt: at };
}

function isLastWord(state: TestState) {
  return state.wordIndex >= state.words.length - 1;
}

// time tests are ended by the caller when the clock runs out
function endsOnCompletion(state: TestState) {
  return state.config.mode !== "time";
}

export function applyKey(state: TestState, input: KeyInput, at: number): TestState {
  if (state.status === "finished") return state;

  switch (input.type) {
    case "char":
      return applyChar(state, input.char, at);
    case "space":
      return applySpace(state, at);
    case "backspace":
      return applyBackspace(state, input.whole ?? false);
  }
}

// start the clock without a keystroke — a race starts everyone on the same
// instant whether they're ready or not
export function beginTest(state: TestState, at: number): TestState {
  return start(state, at);
}

function start(state: TestState, at: number): TestState {
  if (state.status !== "idle") return state;
  return { ...state, status: "running", startedAt: at };
}

function applyChar(state: TestState, char: string, at: number): TestState {
  const target = state.words[state.wordIndex];
  const current = state.typed[state.wordIndex];

  // past the overflow cap, drop the keystroke entirely
  if (current.length >= target.length + MAX_EXTRA_CHARS) return state;

  const expected = current.length < target.length ? target[current.length] : undefined;
  const correct = expected !== undefined && char === expected;

  const started = start(state, at);
  const keypresses = started.keypresses + 1;
  const errorTimes = correct ? started.errorTimes : [...started.errorTimes, at];

  // exact mode: count the error but don't advance
  if (state.rules.exactMode && !correct) {
    return { ...started, keypresses, errorTimes };
  }

  const typed = [...started.typed];
  typed[started.wordIndex] = current + char;

  const next: TestState = { ...started, typed, keypresses, errorTimes };

  // completing the last word correctly ends the test, no trailing space needed
  if (endsOnCompletion(next) && isLastWord(next) && typed[next.wordIndex] === target) {
    return finishTest(next, at);
  }

  return next;
}

function applySpace(state: TestState, at: number): TestState {
  // a leading space shouldn't start the clock, and space on an empty word
  // shouldn't skip it
  if (state.status === "idle") return state;

  const current = state.typed[state.wordIndex];
  if (current.length === 0) return state;

  const target = state.words[state.wordIndex];

  // exact mode: can't leave a word until it matches
  if (state.rules.exactMode && current !== target) {
    return { ...state, keypresses: state.keypresses + 1, errorTimes: [...state.errorTimes, at] };
  }

  // the space is a keypress but never an error — mistakes in the word it
  // commits were already counted per character
  const wordIndex = state.wordIndex + 1;
  const next: TestState = { ...state, wordIndex, keypresses: state.keypresses + 1 };

  if (wordIndex >= state.words.length) return finishTest(next, at);
  return next;
}

function applyBackspace(state: TestState, whole: boolean): TestState {
  if (!state.rules.allowBackspace) return state;
  if (state.status === "idle") return state;

  const current = state.typed[state.wordIndex];

  if (current.length > 0) {
    const typed = [...state.typed];
    typed[state.wordIndex] = whole ? "" : current.slice(0, -1);
    return { ...state, typed };
  }

  if (state.wordIndex === 0) return state;

  // backing into a perfect word needs freedom mode; a wrong one is always open
  const previous = state.wordIndex - 1;
  const wasPerfect = state.typed[previous] === state.words[previous];
  if (wasPerfect && !state.rules.freedomBackspace) return state;

  return { ...state, wordIndex: previous };
}

/* -------------------------------------------------------------------------- */
/* Derived values                                                              */
/* -------------------------------------------------------------------------- */

export function elapsedMs(state: TestState, now: number) {
  if (state.startedAt === null) return 0;
  // clamp: the caller's sampled `now` can briefly predate the first keystroke
  return Math.max(0, (state.endedAt ?? now) - state.startedAt);
}

/** Seconds left in a time test, floored at zero. `Infinity` for other modes. */
export function remainingSeconds(state: TestState, now: number) {
  if (state.config.mode !== "time") return Number.POSITIVE_INFINITY;
  if (state.startedAt === null) return state.config.seconds;
  return Math.max(0, state.config.seconds - elapsedMs(state, now) / 1000);
}

// the caret as a single char index into the flattened text (words joined by
// spaces) — the entire rival-caret payload
export function cursorIndex(state: TestState) {
  let index = 0;
  for (let i = 0; i < state.wordIndex; i++) index += state.words[i].length + 1;
  return index + Math.min(state.typed[state.wordIndex]?.length ?? 0, state.words[state.wordIndex]?.length ?? 0);
}

// inverse of `cursorIndex`. clamps overshoot instead of throwing — the index
// arrives over the network
export function locateCursor(words: readonly string[], index: number) {
  let remaining = Math.max(0, index);

  for (let i = 0; i < words.length; i++) {
    const span = words[i].length + 1; // word + trailing space
    if (remaining < span) return { wordIndex: i, charIndex: Math.min(remaining, words[i].length) };
    remaining -= span;
  }

  const last = Math.max(0, words.length - 1);
  return { wordIndex: last, charIndex: words[last]?.length ?? 0 };
}

/** total characters in the test text, for turning `cursorIndex` into a ratio */
export function totalChars(words: readonly string[]) {
  return words.reduce((sum, word) => sum + word.length, 0) + Math.max(0, words.length - 1);
}

export type CharStatus = "pending" | "correct" | "incorrect" | "extra";

/** per-character render state for one word */
export function wordCharStatuses(target: string, typed: string, isActive: boolean): CharStatus[] {
  const statuses: CharStatus[] = [];
  const length = Math.max(target.length, typed.length);

  for (let i = 0; i < length; i++) {
    if (i >= target.length) {
      statuses.push("extra");
    } else if (i >= typed.length) {
      // the untyped tail of a committed word stays plain, not "wrong"
      statuses.push("pending");
    } else {
      statuses.push(typed[i] === target[i] ? "correct" : "incorrect");
    }
  }

  if (!isActive && typed.length === 0) return statuses.map(() => "pending");

  return statuses;
}
