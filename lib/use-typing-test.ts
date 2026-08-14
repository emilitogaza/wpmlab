"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { configKey, type TestConfig } from "./config";
import { applyKey, beginTest, createTestState, finishTest, type KeyInput, type TestState } from "./engine";
import { type Settings, toEngineRules } from "./settings";
import { accuracy, buildResult, type Progress, progress, type Sample, type TestResult, takeSample, wpm } from "./stats";
import { randomSeed } from "./words";

// React binding for the pure engine — the wall clock, sampling interval, and
// sample buffer all live here.

// one 10Hz timer drives everything; second boundaries are derived from it
const TICK_MS = 100;

const EMPTY_PROGRESS: Progress = { correct: 0, incorrect: 0, extra: 0, missed: 0, produced: 0 };

// fixed seed for SSR and the first client render — a random one would fail
// hydration. swapped for a real seed before paint (layout effect below).
const HYDRATION_SEED = 1;

export type TypingTest = {
  state: TestState;
  /** wall clock, refreshed at 10Hz while running */
  now: number;
  /** non-null exactly when `state.status === "finished"` */
  result: TestResult | null;
  live: { wpm: number; accuracy: number };
  press: (input: KeyInput) => void;
  /** start the clock without a keystroke — race countdown end */
  begin: (at: number) => void;
  /** stop from outside — race grace clock */
  finish: (at: number) => void;
  restart: () => void;
  /** re-run the identical text instead of drawing a new seed */
  repeat: () => void;
};

export type TypingTestOptions = {
  /** a race passes the room's seed so every player gets identical text */
  seed?: number;
};

export function useTypingTest(config: TestConfig, settings: Settings, options: TypingTestOptions = {}): TypingTest {
  const externalSeed = options.seed;
  const rules = useMemo(() => toEngineRules(settings), [settings]);
  const [seed, setSeed] = useState(externalSeed ?? HYDRATION_SEED);
  const [state, setState] = useState(() => createTestState(config, rules, seed));
  const [now, setNow] = useState(() => Date.now());

  // state, not a ref — the results screen derives from this during render.
  // `last` is the progress at the previous sample, turning totals per-second.
  const [sampling, setSampling] = useState<{ samples: Sample[]; last: Progress }>({
    samples: [],
    last: EMPTY_PROGRESS,
  });

  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const reset = useCallback(
    (nextSeed: number) => {
      setSampling({ samples: [], last: EMPTY_PROGRESS });
      setSeed(nextSeed);
      setState(createTestState(config, rules, nextSeed));
      setNow(Date.now());
    },
    [config, rules],
  );

  const restart = useCallback(() => reset(randomSeed()), [reset]);
  const repeat = useCallback(() => reset(seed), [reset, seed]);

  // swap in a real seed before paint; an external (race) seed isn't ours to re-roll
  const seeded = useRef(false);
  useLayoutEffect(() => {
    if (externalSeed !== undefined || seeded.current) return;
    seeded.current = true;
    reset(randomSeed());
  }, [reset, externalSeed]);

  // follow an external seed change (a rematch deals new text to everyone)
  const appliedSeedRef = useRef(externalSeed);
  useEffect(() => {
    if (externalSeed === undefined || appliedSeedRef.current === externalSeed) return;
    appliedSeedRef.current = externalSeed;
    reset(externalSeed);
  }, [externalSeed, reset]);

  // a config/rules change mid-test invalidates the run. keyed on value, not
  // object identity, so a settings-provider re-render doesn't wipe a test.
  const invalidationKey = `${configKey(config)}|${rules.exactMode}|${rules.allowBackspace}|${rules.freedomBackspace}`;
  const previousKeyRef = useRef(invalidationKey);
  useEffect(() => {
    if (previousKeyRef.current === invalidationKey) return;
    previousKeyRef.current = invalidationKey;
    restart();
  }, [invalidationKey, restart]);

  const press = useCallback((input: KeyInput) => {
    setState((current) => applyKey(current, input, Date.now()));
  }, []);

  const begin = useCallback((at: number) => {
    setState((current) => beginTest(current, at));
  }, []);

  const finish = useCallback((at: number) => {
    setState((current) => (current.status === "running" ? finishTest(current, at) : current));
  }, []);

  // run loop: refresh the clock, close out elapsed seconds, end time tests
  const running = state.status === "running";
  const startedAt = state.startedAt;

  useEffect(() => {
    if (!running || startedAt === null) return;

    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);

      const current = stateRef.current;
      const completeSeconds = Math.floor((t - startedAt) / 1000);

      setSampling((previous) => {
        if (previous.samples.length >= completeSeconds) return previous;

        const samples = [...previous.samples];
        let last = previous.last;

        while (samples.length < completeSeconds) {
          const second = samples.length + 1;
          samples.push(takeSample(current, last, startedAt + second * 1000, second));
          last = progress(current);
        }

        return { samples, last };
      });

      if (current.config.mode === "time" && t - startedAt >= current.config.seconds * 1000) {
        // end exactly on the boundary, not on whichever tick noticed it
        setState((s) => finishTest(s, startedAt + s.config.seconds * 1000));
      }
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [running, startedAt]);

  const result = useMemo(() => {
    if (state.status !== "finished" || state.startedAt === null) return null;

    const end = state.endedAt ?? state.startedAt;
    const samples = [...sampling.samples];
    const uncovered = end - state.startedAt - samples.length * 1000;

    // final partial second gets its own point, scaled so it doesn't read as a stall
    if (uncovered > 250) {
      samples.push(takeSample(state, sampling.last, end, samples.length + 1, uncovered));
    }

    return buildResult(state, samples, end);
  }, [state, sampling]);

  const live = useMemo(() => {
    const chars = progress(state);
    const ms = state.startedAt === null ? 0 : (state.endedAt ?? now) - state.startedAt;
    // same functions as the final result, so the numbers can never disagree
    return {
      wpm: wpm(chars.correct, ms),
      accuracy: accuracy(state.keypresses, state.errorTimes.length),
    };
  }, [state, now]);

  return { state, now, result, live, press, begin, finish, restart, repeat };
}
