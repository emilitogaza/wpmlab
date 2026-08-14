"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, parseSettings, SETTINGS_STORAGE_KEY, type Settings } from "@/lib/settings";

// Settings live in localStorage, read via useSyncExternalStore. The server
// snapshot is the defaults, so first paint matches SSR and the real values
// swap in after hydration. Bonus: a second tab picks up changes for free.

// getSnapshot must return a stable reference or React re-renders forever —
// cache the parsed object against the raw string it came from
let cache: { raw: string | null; value: Settings } = { raw: null, value: DEFAULT_SETTINGS };

function getSnapshot(): Settings {
  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (raw !== cache.raw) cache = { raw, value: parseSettings(raw) };
  return cache.value;
}

function getServerSnapshot(): Settings {
  return DEFAULT_SETTINGS;
}

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // `storage` only fires in *other* tabs; same-tab writes notify directly.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

type SettingsContextValue = {
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...getSnapshot(), [key]: value };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    emit();
  }, []);

  const resetSettings = useCallback(() => {
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    emit();
  }, []);

  const value = useMemo(() => ({ settings, setSetting, resetSettings }), [settings, setSetting, resetSettings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside <SettingsProvider>");
  return context;
}
