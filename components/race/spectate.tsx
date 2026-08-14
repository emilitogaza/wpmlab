"use client";

import { useState } from "react";
import { Standings } from "@/components/race/standings";
import { useSettings } from "@/components/settings-provider";
import { WordStream } from "@/components/word-stream";
import { configKey } from "@/lib/config";
import { createTestState } from "@/lib/engine";
import type { RaceSnapshot } from "@/lib/race/types";

// Read-only view for late joiners and mid-race reloaders: the real text with
// every racer's caret, plus standings. useRace claims them a seat at the next
// lobby automatically.

/** rules for a state nobody will ever type into */
const INERT_RULES = { exactMode: false, allowBackspace: true, freedomBackspace: false };

export function Spectate({ snapshot }: { snapshot: RaceSnapshot }) {
  const { settings } = useSettings();

  // static text layout, rebuilt only when the round changes — snapshots arrive
  // at 10Hz, so a useMemo keyed on the snapshot would relayout constantly
  const roundKey = `${configKey(snapshot.config)}:${snapshot.seed}`;
  const [layout, setLayout] = useState(() => ({
    key: roundKey,
    state: createTestState(snapshot.config, INERT_RULES, snapshot.seed),
  }));
  if (layout.key !== roundKey) {
    setLayout({ key: roundKey, state: createTestState(snapshot.config, INERT_RULES, snapshot.seed) });
  }

  const racers = snapshot.players
    .filter((p) => p.connected)
    .map((p) => ({ id: p.id, name: p.name, colorIndex: p.colorIndex, cursor: p.cursor }));

  return (
    <div className="flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl">race in progress</h1>
        <p className="text-ink-dim text-sm">
          {snapshot.status === "countdown" ? "they are about to start — " : ""}
          you&apos;ll join automatically when this round ends
        </p>
      </div>

      <WordStream
        state={layout.state}
        caretStyle="off"
        smoothCaret={false}
        fontSize={settings.fontSize}
        blind={false}
        typing={false}
        focused
        rivals={racers}
      />

      <Standings players={snapshot.players} totalChars={snapshot.totalChars} meId={null} />
    </div>
  );
}
