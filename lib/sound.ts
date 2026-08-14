import type { SoundOnClick } from "./settings";

// Keystroke feedback, synthesised — no audio files to ship, no load latency.

let context: AudioContext | null = null;

function audioContext() {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  // browsers suspend the context until a gesture; typing is a gesture
  if (context.state === "suspended") void context.resume();
  return context;
}

export function playKeySound(kind: SoundOnClick, error = false) {
  if (kind === "off") return;

  const ctx = audioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;

  if (kind === "click") {
    // short, dry, low — reads as a keyswitch rather than a tone
    osc.type = "square";
    osc.frequency.setValueAtTime(error ? 140 : 320, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    osc.start(now);
    osc.stop(now + 0.03);
  } else {
    osc.type = "sine";
    osc.frequency.setValueAtTime(error ? 220 : 660, now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  osc.connect(gain).connect(ctx.destination);
}
