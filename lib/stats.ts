import { elapsedMs, type TestState } from "./engine";

/** character-level tally of everything produced so far */
export type Progress = {
  /** chars matching the target, plus one per committed space */
  correct: number;
  incorrect: number;
  /** chars typed past the end of a word */
  extra: number;
  /** chars of a committed word that were never typed */
  missed: number;
  /** everything typed incl. committed spaces — feeds raw wpm */
  produced: number;
};

// recomputed from state rather than accumulated while typing — backspacing
// over a mistake has to un-count it
export function progress(state: TestState): Progress {
  let correct = 0;
  let incorrect = 0;
  let extra = 0;
  let missed = 0;
  let produced = 0;

  const last = Math.min(state.wordIndex, state.words.length - 1);

  for (let i = 0; i <= last; i++) {
    const target = state.words[i];
    const typed = state.typed[i] ?? "";
    const committed = i < state.wordIndex;

    for (let j = 0; j < typed.length; j++) {
      if (j >= target.length) extra++;
      else if (typed[j] === target[j]) correct++;
      else incorrect++;
    }

    produced += typed.length;

    if (committed) {
      missed += Math.max(0, target.length - typed.length);
      // the committing space counts as a correct char, like every wpm definition
      correct++;
      produced++;
    }
  }

  return { correct, incorrect, extra, missed, produced };
}

const MS_PER_MINUTE = 60_000;

// below this the extrapolation is nonsense (a few chars in a tiny window reads
// as thousands of wpm) — key repeat or clock weirdness, so report 0
const MIN_MEASURABLE_MS = 250;

/** net wpm: correct chars only, five chars to a "word" */
export function wpm(correctChars: number, ms: number) {
  if (ms < MIN_MEASURABLE_MS) return 0;
  return (correctChars / 5) * (MS_PER_MINUTE / ms);
}

/** raw wpm: everything typed, right or wrong */
export function rawWpm(producedChars: number, ms: number) {
  if (ms < MIN_MEASURABLE_MS) return 0;
  return (producedChars / 5) * (MS_PER_MINUTE / ms);
}

// backspacing over a mistake and retyping doesn't repair accuracy — intentional
export function accuracy(keypresses: number, errors: number) {
  if (keypresses === 0) return 100;
  return Math.max(0, ((keypresses - errors) / keypresses) * 100);
}

/* -------------------------------------------------------------------------- */
/* Per-second sampling                                                         */
/* -------------------------------------------------------------------------- */

export type Sample = {
  /** seconds since the test started, 1-based */
  second: number;
  /** net wpm over the whole test so far — the smooth line */
  wpm: number;
  /** chars produced this second alone — the spiky line */
  raw: number;
  errors: number;
};

// windowMs is a parameter so the final partial second scales correctly instead
// of reading as a sudden stall
export function takeSample(state: TestState, previous: Progress, now: number, second: number, windowMs = 1000): Sample {
  const current = progress(state);
  const ms = elapsedMs(state, now);
  const producedThisSecond = current.produced - previous.produced;

  const windowStart = now - windowMs;
  const errors = state.errorTimes.filter((t) => t >= windowStart && t < now).length;

  return {
    second,
    wpm: wpm(current.correct, ms),
    raw: rawWpm(producedThisSecond, windowMs),
    errors,
  };
}

/** 100 × (1 − coefficient of variation) over the per-second raw speeds */
export function consistency(samples: readonly Sample[]) {
  const values = samples.map((s) => s.raw);
  if (values.length < 2) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return 0;

  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const cv = Math.sqrt(variance) / mean;

  return Math.max(0, Math.min(100, (1 - cv) * 100));
}

export type TestResult = {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  characters: Progress;
  durationMs: number;
  samples: Sample[];
};

export function buildResult(state: TestState, samples: Sample[], now: number): TestResult {
  const chars = progress(state);
  const ms = elapsedMs(state, now);

  return {
    wpm: wpm(chars.correct, ms),
    rawWpm: rawWpm(chars.produced, ms),
    accuracy: accuracy(state.keypresses, state.errorTimes.length),
    consistency: consistency(samples),
    characters: chars,
    durationMs: ms,
    samples,
  };
}
