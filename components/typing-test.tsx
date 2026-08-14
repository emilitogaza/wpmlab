"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfigBar } from "@/components/config-bar";
import { StartRaceButton } from "@/components/race/start-race-button";
import { Results } from "@/components/results";
import { useSettings } from "@/components/settings-provider";
import { WordStream } from "@/components/word-stream";
import { DEFAULT_CONFIG, type TestConfig } from "@/lib/config";
import { remainingSeconds } from "@/lib/engine";
import { effectiveBlindMode } from "@/lib/settings";
import { playKeySound } from "@/lib/sound";
import { useTypingTest } from "@/lib/use-typing-test";
import { cn } from "@/lib/utils";

/** how long the caret stays solid after a keystroke before blinking again */
const TYPING_IDLE_MS = 900;

export function TypingTest({ settingsOpen }: { settingsOpen: boolean }) {
  const { settings } = useSettings();
  const [config, setConfig] = useState<TestConfig>(DEFAULT_CONFIG);
  const [typing, setTyping] = useState(false);
  const [windowFocused, setWindowFocused] = useState(true);
  const typingTimer = useRef<number | null>(null);

  const test = useTypingTest(config, settings);
  const { state, press, restart, repeat, result, live, now } = test;

  const patchConfig = useCallback((patch: Partial<TestConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
  }, []);

  const markTyping = useCallback(() => {
    setTyping(true);
    if (typingTimer.current !== null) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => setTyping(false), TYPING_IDLE_MS);
  }, []);

  useEffect(() => {
    const onFocus = () => setWindowFocused(true);
    const onBlur = () => setWindowFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // keys are captured at the window — a real <input> would fight the caret
  // rendering for control of the text
  useEffect(() => {
    if (settingsOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      // don't swallow keys aimed at a real control
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "Tab" && settings.quickRestart) {
        event.preventDefault();
        restart();
        return;
      }

      if (state.status === "finished") return;

      const modified = event.ctrlKey || event.metaKey || event.altKey;

      if (event.key === "Backspace") {
        event.preventDefault();
        press({ type: "backspace", whole: modified });
        markTyping();
        return;
      }

      if (modified) return;

      // `code` fallback: some older engines report the spacebar as "Spacebar"
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        press({ type: "space" });
        markTyping();
        playKeySound(settings.soundOnClick);
        return;
      }

      if (event.key.length === 1) {
        const word = state.words[state.wordIndex] ?? "";
        const position = state.typed[state.wordIndex]?.length ?? 0;
        const wrong = position >= word.length || event.key !== word[position];

        press({ type: "char", char: event.key });
        markTyping();
        playKeySound(settings.soundOnClick, wrong);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen, settings.quickRestart, settings.soundOnClick, state, press, restart, markTyping]);

  const finished = state.status === "finished";
  const running = state.status === "running";
  const focused = windowFocused && !settingsOpen;

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-10">
      {finished && result ? (
        <Results result={result} config={config} exactMode={settings.exactMode} onRestart={restart} onRepeat={repeat} />
      ) : (
        <>
          <ConfigBar config={config} onChange={patchConfig} hidden={running} />

          <div className="w-full">
            <LiveBar
              show={settings.showLiveProgress || settings.showLiveWpm || settings.showLiveAccuracy}
              running={running}
              progress={
                settings.showLiveProgress
                  ? config.mode === "time"
                    ? `${Math.ceil(remainingSeconds(state, now))}`
                    : `${state.wordIndex}/${state.words.length}`
                  : null
              }
              wpm={settings.showLiveWpm ? Math.round(live.wpm) : null}
              accuracy={settings.showLiveAccuracy ? Math.round(live.accuracy) : null}
            />

            <WordStream
              state={state}
              caretStyle={settings.caretStyle}
              smoothCaret={settings.smoothCaret}
              fontSize={settings.fontSize}
              blind={effectiveBlindMode(settings)}
              typing={typing}
              focused={focused}
            />
          </div>

          <div className="flex flex-col items-center gap-4">
            <p className="font-mono text-ink-faint text-xs">
              {settings.quickRestart ? (
                <>
                  <Key>tab</Key> restart test
                </>
              ) : (
                "start typing to begin"
              )}
            </p>
            {/* hidden mid-run — don't invite navigation away from a test */}
            {!running && <StartRaceButton />}
          </div>
        </>
      )}
    </div>
  );
}

function LiveBar({
  show,
  running,
  progress,
  wpm,
  accuracy,
}: {
  show: boolean;
  running: boolean;
  progress: string | null;
  wpm: number | null;
  accuracy: number | null;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex h-8 items-baseline gap-5 font-mono text-2xl text-brand-ink tabular-nums transition-opacity duration-200",
        // invisible but present before the start, so nothing shifts on the first key
        show && running ? "opacity-100" : "opacity-0",
      )}
      aria-live="off"
    >
      {progress !== null && <span>{progress}</span>}
      {wpm !== null && (
        <span className="text-ink-dim text-xl">
          {wpm} <span className="text-ink-faint text-sm">wpm</span>
        </span>
      )}
      {accuracy !== null && (
        <span className="text-ink-dim text-xl">
          {accuracy}
          <span className="text-ink-faint text-sm">%</span>
        </span>
      )}
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-1 bg-fill-muted px-1.5 py-0.5 text-ink-dim">{children}</kbd>;
}
