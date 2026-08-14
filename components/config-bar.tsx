"use client";

import { AtSign, Clock, Hash, Quote, Type } from "lucide-react";
import { m } from "motion/react";
import { Chip, ChipGroup } from "@/components/ui/chip";
import {
  QUOTE_LENGTHS,
  type QuoteLength,
  type TestConfig,
  type TestMode,
  TIME_OPTIONS,
  WORD_OPTIONS,
} from "@/lib/config";

const MODES: { value: TestMode; label: string; icon: React.ReactNode }[] = [
  { value: "time", label: "time", icon: <Clock className="icon-3.5" /> },
  { value: "words", label: "words", icon: <Type className="icon-3.5" /> },
  { value: "quote", label: "quote", icon: <Quote className="icon-3.5" /> },
];

type ConfigBarProps = {
  config: TestConfig;
  onChange: (patch: Partial<TestConfig>) => void;
  /** Hidden while typing, the way monkeytype gets out of your way. */
  hidden: boolean;
};

export function ConfigBar({ config, onChange, hidden }: ConfigBarProps) {
  const showModifiers = config.mode !== "quote";

  return (
    <m.div
      initial={false}
      animate={{ opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.15 }}
      // Kept in the layout when hidden so the typing surface never shifts, but
      // taken out of the tab order so it cannot be focused invisibly.
      inert={hidden}
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {showModifiers && (
        <ChipGroup>
          <Chip
            active={config.punctuation}
            icon={<AtSign className="icon-3.5" />}
            onClick={() => onChange({ punctuation: !config.punctuation })}
          >
            punctuation
          </Chip>
          <Chip
            active={config.numbers}
            icon={<Hash className="icon-3.5" />}
            onClick={() => onChange({ numbers: !config.numbers })}
          >
            numbers
          </Chip>
        </ChipGroup>
      )}

      <ChipGroup>
        {MODES.map((mode) => (
          <Chip
            key={mode.value}
            active={config.mode === mode.value}
            icon={mode.icon}
            onClick={() => onChange({ mode: mode.value })}
          >
            {mode.label}
          </Chip>
        ))}
      </ChipGroup>

      <ChipGroup>
        {config.mode === "time" &&
          TIME_OPTIONS.map((seconds) => (
            <Chip key={seconds} active={config.seconds === seconds} onClick={() => onChange({ seconds })}>
              {seconds}
            </Chip>
          ))}

        {config.mode === "words" &&
          WORD_OPTIONS.map((wordCount) => (
            <Chip key={wordCount} active={config.wordCount === wordCount} onClick={() => onChange({ wordCount })}>
              {wordCount}
            </Chip>
          ))}

        {config.mode === "quote" &&
          QUOTE_LENGTHS.map((quoteLength: QuoteLength) => (
            <Chip
              key={quoteLength}
              active={config.quoteLength === quoteLength}
              onClick={() => onChange({ quoteLength })}
            >
              {quoteLength}
            </Chip>
          ))}
      </ChipGroup>
    </m.div>
  );
}
