// Per-test config (the top bar). User settings live in lib/settings.ts.

export type TestMode = "time" | "words" | "quote";
export type QuoteLength = "any" | "short" | "medium" | "long";

export const TIME_OPTIONS = [15, 30, 60, 120] as const;
export const WORD_OPTIONS = [10, 25, 50, 100] as const;
export const QUOTE_LENGTHS: QuoteLength[] = ["any", "short", "medium", "long"];

export type TestConfig = {
  mode: TestMode;
  seconds: number;
  wordCount: number;
  quoteLength: QuoteLength;
  punctuation: boolean;
  numbers: boolean;
};

export const DEFAULT_CONFIG: TestConfig = {
  mode: "time",
  seconds: 30,
  wordCount: 25,
  quoteLength: "any",
  punctuation: false,
  numbers: false,
};

// quotes are fixed text, so the punctuation/numbers toggles don't apply
export function supportsModifiers(config: TestConfig) {
  return config.mode !== "quote";
}

// clamp an untrusted config (off the wire) onto the option lists — matched,
// never copied. wordCount: 1e9 would otherwise hang generateWords.
export function sanitizeConfig(input: unknown): TestConfig | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;

  const mode = raw.mode;
  if (mode !== "time" && mode !== "words" && mode !== "quote") return null;

  return {
    mode,
    seconds: TIME_OPTIONS.find((s) => s === raw.seconds) ?? DEFAULT_CONFIG.seconds,
    wordCount: WORD_OPTIONS.find((w) => w === raw.wordCount) ?? DEFAULT_CONFIG.wordCount,
    quoteLength: QUOTE_LENGTHS.find((q) => q === raw.quoteLength) ?? DEFAULT_CONFIG.quoteLength,
    punctuation: raw.punctuation === true,
    numbers: raw.numbers === true,
  };
}

/** short label for the results screen ("time 30", "words 50") */
export function describeConfig(config: TestConfig) {
  switch (config.mode) {
    case "time":
      return `time ${config.seconds}`;
    case "words":
      return `words ${config.wordCount}`;
    case "quote":
      return config.quoteLength === "any" ? "quote" : `quote ${config.quoteLength}`;
  }
}

/** everything a peer needs to lay out the identical test */
export function configKey(config: TestConfig) {
  return [
    config.mode,
    config.mode === "time" ? config.seconds : config.mode === "words" ? config.wordCount : config.quoteLength,
    config.punctuation ? "p" : "",
    config.numbers ? "n" : "",
  ].join(":");
}
