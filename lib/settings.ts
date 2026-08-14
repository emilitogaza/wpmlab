// User settings, persisted across tests. No React in here — the engine
// imports the rules type from this module.

export type CaretStyle = "block" | "line" | "underline" | "off";
export type FontSize = "sm" | "md" | "lg" | "xl";
export type SoundOnClick = "off" | "click" | "beep";

export type Settings = {
  /** TypeRacer rules: wrong keys are rejected and the caret stays put */
  exactMode: boolean;
  /** backspace disabled entirely */
  confidenceMode: boolean;
  /** allow backspacing into words already finished correctly */
  freedomBackspace: boolean;
  /** no correct/incorrect colouring while typing */
  blindMode: boolean;
  showLiveWpm: boolean;
  showLiveAccuracy: boolean;
  /** remaining time / word count while typing */
  showLiveProgress: boolean;
  caretStyle: CaretStyle;
  smoothCaret: boolean;
  /** tab restarts the test from anywhere */
  quickRestart: boolean;
  soundOnClick: SoundOnClick;
  fontSize: FontSize;
  /** shown to other players in a race */
  playerName: string;
};

export const DEFAULT_SETTINGS: Settings = {
  exactMode: false,
  confidenceMode: false,
  freedomBackspace: false,
  blindMode: false,
  showLiveWpm: true,
  showLiveAccuracy: false,
  showLiveProgress: true,
  // line sits between characters; block/underline cover the char you're reading
  caretStyle: "line",
  smoothCaret: true,
  quickRestart: true,
  soundOnClick: "off",
  fontSize: "lg",
  playerName: "",
};

export const SETTINGS_STORAGE_KEY = "wpmlab:settings:v1";

export const CARET_STYLES: CaretStyle[] = ["block", "line", "underline", "off"];
export const FONT_SIZES: FontSize[] = ["sm", "md", "lg", "xl"];
export const SOUND_OPTIONS: SoundOnClick[] = ["off", "click", "beep"];

// enums are checked against their allowed values, not just typeof — a stored
// caretStyle from an old build must not index to undefined at render time
const VALIDATORS: { [K in keyof Settings]: (value: unknown) => value is Settings[K] } = {
  exactMode: isBoolean,
  confidenceMode: isBoolean,
  freedomBackspace: isBoolean,
  blindMode: isBoolean,
  showLiveWpm: isBoolean,
  showLiveAccuracy: isBoolean,
  showLiveProgress: isBoolean,
  smoothCaret: isBoolean,
  quickRestart: isBoolean,
  caretStyle: oneOf(CARET_STYLES),
  fontSize: oneOf(FONT_SIZES),
  soundOnClick: oneOf(SOUND_OPTIONS),
  playerName: isString,
};

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function oneOf<T extends string>(allowed: T[]) {
  return (value: unknown): value is T => typeof value === "string" && (allowed as string[]).includes(value);
}

// merge stored settings over the defaults, dropping anything that no longer validates
export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }

  if (typeof parsed !== "object" || parsed === null) return DEFAULT_SETTINGS;
  const record = parsed as Record<string, unknown>;
  const merged = { ...DEFAULT_SETTINGS };

  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    assign(merged, record, key);
  }

  return merged;
}

// split out so K binds to one concrete key and the predicate lines up
function assign<K extends keyof Settings>(target: Settings, source: Record<string, unknown>, key: K) {
  const value = source[key];
  if (VALIDATORS[key](value)) target[key] = value;
}

// exact mode already blocks wrong keys, so blind mode has nothing to hide
export function blindModeAvailable(settings: Settings) {
  return !settings.exactMode;
}

export function effectiveBlindMode(settings: Settings) {
  return settings.blindMode && blindModeAvailable(settings);
}

/** the subset the pure engine actually needs */
export type EngineRules = {
  exactMode: boolean;
  allowBackspace: boolean;
  freedomBackspace: boolean;
};

export function toEngineRules(settings: Settings): EngineRules {
  return {
    exactMode: settings.exactMode,
    allowBackspace: !settings.confidenceMode,
    freedomBackspace: settings.freedomBackspace,
  };
}
