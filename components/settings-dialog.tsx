"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useId } from "react";
import { useSettings } from "@/components/settings-provider";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Switch } from "@/components/ui/switch";
import { blindModeAvailable, type CaretStyle, type FontSize, type SoundOnClick } from "@/lib/settings";
import { cn } from "@/lib/utils";

const CARET_STYLES: CaretStyle[] = ["block", "line", "underline", "off"];
const FONT_SIZES: FontSize[] = ["sm", "md", "lg", "xl"];
const SOUNDS: SoundOnClick[] = ["off", "click", "beep"];

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { settings, setSetting, resetSettings } = useSettings();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-fill-dark/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(42rem,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col",
            "rounded-4 border border-border bg-fill-raised shadow-2xl outline-none",
          )}
        >
          <div className="flex items-center justify-between border-border border-b px-6 py-4">
            <Dialog.Title className="text-xl">settings</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close settings"
                className="cursor-pointer rounded-1_5 p-1 text-ink-faint transition-colors hover:bg-fill-muted hover:text-ink"
              >
                <X className="icon-4" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">
            Change how tests behave and how the typing surface is displayed. Changes apply immediately and restart the
            current test.
          </Dialog.Description>

          <div className="flex flex-col gap-8 overflow-y-auto px-6 py-6">
            <Section title="behaviour">
              <ToggleRow
                label="exact mode"
                description="TypeRacer rules: a wrong key is rejected and the caret stays put, so you must type every character correctly to move on. Off, you can type straight through mistakes and they count against accuracy instead."
                checked={settings.exactMode}
                onChange={(v) => setSetting("exactMode", v)}
              />
              <ToggleRow
                label="confidence mode"
                description="Backspace is disabled. Every keystroke is final."
                checked={settings.confidenceMode}
                onChange={(v) => setSetting("confidenceMode", v)}
              />
              <ToggleRow
                label="freedom backspace"
                description="Go back into words you already finished, even the ones you got right. Off, you can only return to a word you got wrong."
                checked={settings.freedomBackspace}
                disabled={settings.confidenceMode}
                disabledReason="Confidence mode has backspace turned off entirely."
                onChange={(v) => setSetting("freedomBackspace", v)}
              />
              <ToggleRow
                label="blind mode"
                description="No right-or-wrong colouring while you type. You find out how it went on the results screen."
                checked={settings.blindMode}
                disabled={!blindModeAvailable(settings)}
                disabledReason="Exact mode already blocks every wrong keystroke, so there is nothing to hide."
                onChange={(v) => setSetting("blindMode", v)}
              />
              <ToggleRow
                label="quick restart"
                description="Tab starts a fresh test from anywhere, without reaching for the mouse."
                checked={settings.quickRestart}
                onChange={(v) => setSetting("quickRestart", v)}
              />
            </Section>

            <Section title="display">
              <ToggleRow
                label="live wpm"
                description="Show your current speed while typing."
                checked={settings.showLiveWpm}
                onChange={(v) => setSetting("showLiveWpm", v)}
              />
              <ToggleRow
                label="live accuracy"
                description="Show running accuracy while typing."
                checked={settings.showLiveAccuracy}
                onChange={(v) => setSetting("showLiveAccuracy", v)}
              />
              <ToggleRow
                label="live progress"
                description="Show the countdown, or how many words are left."
                checked={settings.showLiveProgress}
                onChange={(v) => setSetting("showLiveProgress", v)}
              />
              <ChoiceRow
                label="caret style"
                options={CARET_STYLES}
                value={settings.caretStyle}
                onChange={(v) => setSetting("caretStyle", v)}
              />
              <ToggleRow
                label="smooth caret"
                description="Glide the caret between characters instead of snapping."
                checked={settings.smoothCaret}
                disabled={settings.caretStyle === "off"}
                disabledReason="The caret is hidden."
                onChange={(v) => setSetting("smoothCaret", v)}
              />
              <ChoiceRow
                label="font size"
                options={FONT_SIZES}
                value={settings.fontSize}
                onChange={(v) => setSetting("fontSize", v)}
              />
            </Section>

            <Section title="sound">
              <ChoiceRow
                label="on keypress"
                options={SOUNDS}
                value={settings.soundOnClick}
                onChange={(v) => setSetting("soundOnClick", v)}
              />
            </Section>

            <Section title="racing">
              <TextRow
                label="your name"
                description="Shown to the other players in a race. Takes effect the next time you join one."
                value={settings.playerName}
                placeholder="not set"
                onChange={(v) => setSetting("playerName", v)}
              />
            </Section>
          </div>

          <div className="border-border border-t px-6 py-4">
            <button
              type="button"
              onClick={resetSettings}
              className="cursor-pointer text-ink-faint text-sm transition-colors hover:text-error-ink"
            >
              reset to defaults
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h3 className="text-brand-ink text-sm">{title}</h3>
      {children}
    </section>
  );
}

type ToggleRowProps = {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onChange: (value: boolean) => void;
};

function ToggleRow({ label, description, checked, disabled, disabledReason, onChange }: ToggleRowProps) {
  return (
    <div className={cn("flex items-start justify-between gap-6", disabled && "opacity-50")}>
      <div className="min-w-0">
        <div className="text-ink text-sm">{label}</div>
        <p className="mt-0.5 text-ink-dim text-sm leading-snug">
          {disabled && disabledReason ? disabledReason : description}
        </p>
      </div>
      <Switch
        aria-label={label}
        checked={disabled ? false : checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="mt-1 shrink-0"
      />
    </div>
  );
}

function TextRow({
  label,
  description,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <label htmlFor={id} className="text-ink text-sm">
          {label}
        </label>
        <p className="mt-0.5 text-ink-dim text-sm leading-snug">{description}</p>
      </div>
      <input
        id={id}
        value={value}
        maxLength={16}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value.slice(0, 16))}
        className="w-36 shrink-0 rounded-1_5 bg-fill-muted px-3 py-1.5 text-ink text-sm outline-none placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-brand/60"
      />
    </div>
  );
}

function ChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="text-ink text-sm">{label}</div>
      <ChipGroup className="bg-fill-muted">
        {options.map((option) => (
          <Chip key={option} active={value === option} onClick={() => onChange(option)}>
            {option}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  );
}
