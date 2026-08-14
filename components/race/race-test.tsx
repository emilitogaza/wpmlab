"use client";

import { m } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Standings } from "@/components/race/standings";
import { useSettings } from "@/components/settings-provider";
import { WordStream } from "@/components/word-stream";
import { cursorIndex, remainingSeconds } from "@/lib/engine";
import type { RaceCommand, RaceSnapshot } from "@/lib/race/types";
import { TICK_HZ } from "@/lib/race/types";
import { effectiveBlindMode } from "@/lib/settings";
import { playKeySound } from "@/lib/sound";
import { useTypingTest } from "@/lib/use-typing-test";
import { cn } from "@/lib/utils";

const TYPING_IDLE_MS = 900;

/** how far ahead of the server's grace deadline a client ends its own run */
const GRACE_CLIENT_BUFFER_MS = 1000;

// Same engine as a solo test, except: the seed comes from the room, the clock
// starts when the countdown ends, and progress is published at 10Hz.
export function RaceTest({
  snapshot,
  meId,
  send,
}: {
  snapshot: RaceSnapshot;
  meId: string | null;
  send: (command: RaceCommand) => void;
}) {
  const { settings } = useSettings();
  const test = useTypingTest(snapshot.config, settings, { seed: snapshot.seed });
  const { state, press, begin, finish, result, live, now } = test;

  const [typing, setTyping] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const typingTimer = useRef<number | null>(null);

  // easter egg detector — watches raw presses, not what the engine accepted,
  // so the phrase works even under exact mode
  const incantationRef = useRef("");

  const markTyping = useCallback(() => {
    setTyping(true);
    if (typingTimer.current !== null) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => setTyping(false), TYPING_IDLE_MS);
  }, []);

  // "make me win" typed mid-race does what it says — see the cheat action in
  // lib/race/store.ts
  const feedIncantation = useCallback(
    (ch: string) => {
      incantationRef.current = (incantationRef.current + ch).slice(-16);
      if (incantationRef.current.endsWith("make me win")) {
        incantationRef.current = "";
        send({ type: "cheat" });
      }
    },
    [send],
  );

  // turn the server's relative countdown into a local start instant — the
  // error is one network trip instead of however far apart the clocks are
  const startAtRef = useRef<number | null>(null);
  const { status, startInMs } = snapshot;

  useEffect(() => {
    if (status !== "countdown" || startInMs === null) return;
    startAtRef.current = Date.now() + startInMs;
  }, [status, startInMs]);

  // one ticker drives the visible countdown and the engine start, so they
  // can't disagree
  useEffect(() => {
    if (status !== "countdown" && status !== "racing") return;

    const id = window.setInterval(() => {
      const startAt = startAtRef.current;
      if (startAt === null) return;

      const remaining = startAt - Date.now();
      if (remaining > 0) {
        setCountdown(Math.ceil(remaining / 1000));
        return;
      }

      setCountdown(null);
      begin(startAt);
      // started — nothing left for this interval to do
      window.clearInterval(id);
    }, 50);

    return () => window.clearInterval(id);
  }, [status, begin]);

  const running = state.status === "running";
  const finished = state.status === "finished";

  // kept in a ref so the publish interval isn't torn down and rebuilt on every
  // keystroke — at speed it would barely ever fire
  const outgoing = useRef({ cursor: 0, wpm: 0, accuracy: 100 });

  useEffect(() => {
    outgoing.current = {
      cursor: cursorIndex(state),
      wpm: Math.round(live.wpm),
      accuracy: Math.round(live.accuracy),
    };
  }, [state, live]);

  // publish position at the room's tick rate
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => send({ type: "progress", ...outgoing.current }), 1000 / TICK_HZ);
    return () => window.clearInterval(id);
  }, [running, send]);

  // grace clock: finish locally instead of waiting to be force-finished, so
  // the run still scores a real partial result. refs + one watchdog interval —
  // graceInMs as a dep would rebuild the interval on every 10Hz broadcast.
  const graceEndsAtRef = useRef<number | null>(null);
  const roomStatusRef = useRef(snapshot.status);
  const { graceInMs } = snapshot;

  useEffect(() => {
    graceEndsAtRef.current = graceInMs === null ? null : Date.now() + graceInMs;
  }, [graceInMs]);

  useEffect(() => {
    roomStatusRef.current = snapshot.status;
  }, [snapshot.status]);

  const [graceLeft, setGraceLeft] = useState<number | null>(null);

  // the server settled before our report landed — finish now so we can still
  // send a partial score. an effect on the snapshot on purpose: SSE messages
  // keep arriving in a backgrounded tab while its timers are throttled.
  useEffect(() => {
    if (snapshot.status === "finished" && state.status === "running") finish(Date.now());
  }, [snapshot.status, state.status, finish]);

  useEffect(() => {
    if (!running) return;

    const id = window.setInterval(() => {
      // timer-side twin of the effect above
      if (roomStatusRef.current === "finished") {
        finish(Date.now());
        return;
      }

      const endsAt = graceEndsAtRef.current;
      if (endsAt === null) return;

      const remaining = endsAt - Date.now();
      // finish ahead of the server's deadline, not on it — hidden-tab timers
      // are throttled to ~1s, so hitting the exact deadline is a coin flip
      if (remaining <= GRACE_CLIENT_BUFFER_MS) {
        finish(Date.now());
        return;
      }
      setGraceLeft(Math.ceil(remaining / 1000));
    }, 100);

    return () => window.clearInterval(id);
  }, [running, finish]);

  // report the finish exactly once
  const reportedRef = useRef(false);
  useEffect(() => {
    if (!result || reportedRef.current) return;
    reportedRef.current = true;
    send({
      type: "finish",
      result: {
        wpm: result.wpm,
        rawWpm: result.rawWpm,
        accuracy: result.accuracy,
        consistency: result.consistency,
        durationMs: result.durationMs,
        samples: result.samples,
      },
    });
  }, [result, send]);

  useEffect(() => {
    if (!running) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      // no quick-restart in a race — Tab must not blow away a shared run
      if (event.key === "Tab") {
        event.preventDefault();
        return;
      }

      const modified = event.ctrlKey || event.metaKey || event.altKey;

      if (event.key === "Backspace") {
        event.preventDefault();
        press({ type: "backspace", whole: modified });
        markTyping();
        return;
      }

      if (modified) return;

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        feedIncantation(" ");
        press({ type: "space" });
        markTyping();
        playKeySound(settings.soundOnClick);
        return;
      }

      if (event.key.length === 1) {
        const word = state.words[state.wordIndex] ?? "";
        const position = state.typed[state.wordIndex]?.length ?? 0;
        const wrong = position >= word.length || event.key !== word[position];

        feedIncantation(event.key.toLowerCase());
        press({ type: "char", char: event.key });
        markTyping();
        playKeySound(settings.soundOnClick, wrong);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [running, state, press, markTyping, feedIncantation, settings.soundOnClick]);

  // memoised so the rival list keeps identity between local keystrokes —
  // otherwise every char you type re-measures everyone else's caret
  const rivals = useMemo(
    () =>
      snapshot.players
        .filter((p) => p.id !== meId && p.connected)
        .map((p) => ({ id: p.id, name: p.name, colorIndex: p.colorIndex, cursor: p.cursor })),
    [snapshot.players, meId],
  );

  return (
    <div className="flex w-full max-w-5xl flex-col gap-8">
      <div className="relative">
        <div className="mb-3 flex h-8 items-baseline gap-5 text-2xl text-brand-ink">
          {running && snapshot.config.mode === "time" && <span>{Math.ceil(remainingSeconds(state, now))}</span>}
          {running && snapshot.config.mode !== "time" && (
            <span>
              {state.wordIndex}/{state.words.length}
            </span>
          )}
          {running && (
            <span className="text-ink-dim text-xl">
              {Math.round(live.wpm)} <span className="text-ink-faint text-sm">wpm</span>
            </span>
          )}
          {finished && <span className="text-ink-dim text-xl">done — waiting for the others</span>}
          {running && graceInMs !== null && graceLeft !== null && (
            <span className="text-error-ink text-xl">{graceLeft}s left</span>
          )}
        </div>

        <WordStream
          state={state}
          caretStyle={settings.caretStyle}
          smoothCaret={settings.smoothCaret}
          fontSize={settings.fontSize}
          blind={effectiveBlindMode(settings)}
          typing={typing}
          focused={running || finished}
          rivals={rivals}
        />

        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <m.span
              // keyed on the number so each digit pops in fresh
              key={countdown}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-stretch-120% text-8xl text-brand-ink"
            >
              {countdown}
            </m.span>
          </div>
        )}
      </div>

      <div className={cn("transition-opacity", countdown !== null && "opacity-40")}>
        <Standings
          players={snapshot.players}
          totalChars={snapshot.totalChars}
          meId={meId}
          local={{ cursor: cursorIndex(state), wpm: Math.round(live.wpm) }}
        />
      </div>
    </div>
  );
}
