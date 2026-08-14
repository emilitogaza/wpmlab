"use client";

import { Repeat, RotateCcw } from "lucide-react";
import { m } from "motion/react";
import { ResultsChart } from "@/components/results-chart";
import { IconButton } from "@/components/ui/icon-button";
import { describeConfig, type TestConfig } from "@/lib/config";
import type { TestResult } from "@/lib/stats";

type ResultsProps = {
  result: TestResult;
  config: TestConfig;
  exactMode: boolean;
  onRestart: () => void;
  onRepeat: () => void;
};

export function Results({ result, config, exactMode, onRestart, onRepeat }: ResultsProps) {
  const { characters } = result;

  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex w-full flex-col gap-8"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* the two numbers people came for */}
        <div className="flex shrink-0 flex-row gap-8 lg:w-40 lg:flex-col lg:gap-6">
          <Hero label="wpm" value={Math.round(result.wpm)} />
          <Hero label="acc" value={`${Math.round(result.accuracy)}%`} />
        </div>

        <div className="min-w-0 flex-1">
          <ResultsChart samples={result.samples} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-border border-t pt-6 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="test type">
          {describeConfig(config)}
          <span className="block text-ink-faint">{exactMode ? "exact" : "free"}</span>
        </Stat>
        <Stat label="raw">{Math.round(result.rawWpm)}</Stat>
        <Stat
          label="characters"
          hint="correct / incorrect / extra / missed"
        >{`${characters.correct}/${characters.incorrect}/${characters.extra}/${characters.missed}`}</Stat>
        {/* consistency needs at least two samples to mean anything */}
        <Stat label="consistency">{result.samples.length < 2 ? "—" : `${Math.round(result.consistency)}%`}</Stat>
        <Stat label="time">{`${(result.durationMs / 1000).toFixed(1)}s`}</Stat>
      </dl>

      <div className="flex items-center justify-center gap-2">
        <IconButton onClick={onRestart} aria-label="Next test" title="Next test  (tab)">
          <RotateCcw className="icon-4" />
        </IconButton>
        <IconButton onClick={onRepeat} aria-label="Repeat this text" title="Repeat this text">
          <Repeat className="icon-4" />
        </IconButton>
      </div>
    </m.div>
  );
}

function Hero({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-2xl text-ink-dim leading-none">{label}</div>
      {/* display-scale figure — gets the title width, not the body width */}
      <div className="font-stretch-120% text-6xl text-brand-ink leading-none">{value}</div>
    </div>
  );
}

function Stat({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-dim text-sm" title={hint}>
        {label}
      </dt>
      <dd className="text-2xl text-ink">{children}</dd>
    </div>
  );
}
