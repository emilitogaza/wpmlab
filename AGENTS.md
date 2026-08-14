<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# wpmlab

A typing-speed practice tool: solo tests plus a link-shareable race for up to five players.

# No shadcn/ui

This project deliberately does **not** use shadcn. `components/ui/*` is hand-written and owned by us. Do not run `shadcn add`, do not introduce `components.json`, and do not reintroduce the shadcn colour tokens (`bg-background`, `text-muted-foreground`, `bg-primary`, …) — they don't exist here and would render colourless. Radix primitives are imported directly from the `radix-ui` package where an unstyled, accessible behaviour is worth having (`Switch`, `Dialog`); everything visual is ours.

# Design system (app/globals.css)

All tokens live in `app/globals.css`. Read that file before styling anything.

## Radius

Use the numeric scale only: `rounded-0` … `rounded-16` (4px steps: `rounded-1` = 4px, `rounded-4` = 16px, plus `rounded-1_5` = 6px and `rounded-full`). **Never** use `rounded-sm`/`rounded-md`/`rounded-lg`/`rounded-xl`/`rounded-2xl`/etc. — those aren't part of this scale and silently fall back to the Tailwind defaults, rendering the wrong size.

## Color

Use the semantic ink/fill tokens — never raw palette steps — so light and dark themes both work:

- Text: `text-ink`, `text-ink-dim`, `text-ink-faint`, `text-ink-flip`
- Surfaces: `bg-fill`, `bg-fill-raised`, `bg-fill-muted`, `bg-fill-strong`, `bg-fill-light`, `bg-fill-dark`
- Brand: `text-brand-ink`, `text-brand-ink-flip`, `bg-brand`, `bg-brand-fill`
- Misc: `border-border`, `text-link`, `text-error-ink`, `bg-error`, `bg-error-fill`
- Typing surface: `text-type-pending`, `text-type-correct`, `text-type-error`, `text-type-extra`, `bg-caret`/`text-caret`
- Race: `text-rival-1` … `text-rival-4` (and `bg-*`), for opponent carets and their chart series

**ink is foreground, fill is background — the split is a hard rule.** ink tokens (`ink`, `ink-dim`, `ink-faint`, `ink-flip`, `brand-ink*`, `error-ink`, `type-*`) are only ever text, icons, and strokes. fill tokens are only ever surfaces. Painting a surface with ink is **not allowed** in any form:

- ❌ `bg-ink`, `bg-ink-dim`, `hover:bg-ink/8`, `hover:bg-ink-dim/20`
- ❌ `bg-[color-mix(in_oklch,var(--sem-fill-raised),var(--sem-ink)_8%)]`
- ✅ `hover:bg-fill-muted`, `bg-fill-strong`, `bg-fill-light`

The reason: ink flips with the theme (near-black in light, near-white in dark), so an ink-tinted surface inverts along with it — a "subtle darkening" in light becomes a lightening in dark, and any opacity value that reads right in one theme is wrong in the other.

`caret` and `rival-*` are the two exceptions that legitimately appear as both text and fill: the caret is a painted block, and a rival colour marks both a caret and a chart stroke. They are theme-stable by construction, not flipped ink.

Which fill to reach for:

| token | role |
| --- | --- |
| `fill` | page background |
| `fill-raised` | cards, panels, popovers lifted off the page |
| `fill-muted` | subtle surfaces (chips, skeletons, tracks) **and hover/expanded on a plain surface** |
| `fill-strong` | one step further: hover on an already-muted surface, pressed states |
| `fill-light` | always-light surface in both themes (e.g. a switch thumb) |
| `fill-dark` | always-dark surface in both themes |

If none of them fit, add a new `--sem-fill-*` token in `app/globals.css` (and its `.dark` value) rather than tinting with ink or reaching for a raw `accent-*` step.

Theme-dependent values are defined via `--sem-*` vars in `:root`/`.dark` (next-themes toggles `.dark` on `<html>`, defaulting to the device setting). Two raw ramps feed that layer and are never used directly by components: `--color-accent-*` is the vivid brand purple, `--color-neutral-*` is a purple-tinted grey ramp that every surface and all body text comes from. Never hardcode colors.

## Typography

**One typeface: Mona Sans.** There is deliberately no second font — do not reintroduce `font-mono` or a mono face; the base styles apply the family, so don't add font-family classes per component.

- **Digits are tabular app-wide** (`font-variant-numeric: tabular-nums` on `body`). This is load-bearing, not taste: Mona Sans digits are strongly proportional (a `1` is ~40% narrower than an `8`), so without it every ticking readout — live wpm, countdowns, standings — wobbles as values change width. Never override it on numeric UI.
- **Widths:** body baseline is `font-[550] font-stretch-112% tracking-wide` — buttons and body text are 112 by default, from globals. `<h1>`–`<h6>` get `font-stretch-120%` from base styles — don't repeat it on headings. Display-scale text that isn't a heading (hero figures, the countdown, a wordmark `<span>`) gets the `font-stretch-120%` class explicitly. Use `font-stretch-*` (not `font-variation-settings`) for width.
- **The typing surface is proportional now**, which the caret machinery is built for: carets and rival markers are DOM-measured per character (`measureChar` in word-stream.tsx returns the glyph's own width, and block/underline carets take it). Never reintroduce `1ch`-cell assumptions — "one character wide" is only meaningful per glyph in this face.
- Extended display sizes `text-8xl` … `text-12xl` are available.

## Breakpoints

Defaults plus `xxs` (22rem), `xs` (24rem), and `3xl` (128rem).

## Icons (lucide)

Size icons with `icon-N` (sizes like `size-N` and compensates `stroke-width` so strokes render at `--stroke-width` = 1.6px at any size). `icon-bold` composes for a thicker 2.5 stroke. Don't set `stroke-width` or `size-*` on icons manually. Bare `border` utilities also default to 1.6px via `--default-border-width`.

# Motion

`motion` is loaded **once**, in `components/providers.tsx`, via `<LazyMotion features={domAnimation} strict>`. That mounts from the root layout, so the feature bundle is initialised a single time for the whole app.

`strict` mode means the full `motion.*` components throw. **Always import `m` and use `<m.div>`, never `<motion.div>`** — `m` is the minified component that relies on the already-loaded feature set. If an animation ever needs layout projection or drag, swap the provider to `domMax` rather than importing `motion` locally.

# Typing engine (lib/)

The engine is a pure reducer over keystrokes (`lib/engine.ts`) with a thin React binding (`lib/use-typing-test.ts`). Keep it that way — no DOM reads, no timers, no React inside `engine.ts`. It's the piece a race server has to agree with, and the piece worth unit-testing.

- `lib/words.ts` — word lists and deterministic test-text generation
- `lib/engine.ts` — pure reducer: `createTestState`, `applyKey`, `finishTest`
- `lib/stats.ts` — wpm / raw / accuracy / consistency, and per-second sampling
- `lib/settings.ts` — persisted user settings (localStorage + React context)
- `lib/config.ts` — per-test config (mode, duration, punctuation, …)

## Race invariants

Three properties hold, and the race depends on all of them. Breaking one breaks
multiplayer silently rather than loudly:

1. **Test text is seeded, never random at render.** `generateWords(config, seed)`
   is deterministic, so a race is "everyone runs this config with this seed" and
   the text itself is never sent over the wire.
2. **Progress is one number.** `cursorIndex(state)` is a character index into the
   flattened test text, and `locateCursor(words, index)` is its inverse. That
   pair is the entire rival-caret payload — don't add per-keystroke state a
   rival caret would also need.
3. **The engine never reads the clock itself.** `applyKey` and `beginTest` take
   an explicit `at: number`, which is what lets a race start every player's
   clock on the same instant, and keeps replay and server-side verification
   possible.

# Racing (lib/race/, app/api/race/)

Transport is server-sent events down, plain POSTs up. Room state lives in the
server process's memory (`lib/race/store.ts`), reached only through
`applyAction` — so swapping it for a Durable Object or Redis is a contained
change.

**This means the app must run as one long-lived instance.** On a serverless
platform that spreads requests across instances, two players land in two
different memories and never see each other. `next start`, a container, or a VPS
are all fine.

- `lib/race/types.ts` — the wire protocol, shared by both sides. `RaceCommand` is
  a command without a player id; `RaceAction` is one with. Never write
  `Omit<RaceAction, "playerId">` — `Omit` over a union collapses it to the keys
  its members share and silently loses every payload.
- `lib/race/store.ts` — rooms, players, countdown, and the 10Hz broadcast tick.
  Server only.
- `lib/race/use-race.ts` — the client's EventSource plus a `send` for commands.

`GRACE_MS` is the 15-second clock that starts when the first player finishes.
Clients finish their own run on that deadline (producing a real partial score);
the server force-finishes stragglers as a backstop. A disconnected player never
blocks the finish — `settleIfDone` runs on disconnect as well as on finish.

Late arrivals and mid-race reloaders become **spectators**: a tab only races if
it saw the room as a lobby first (`participating` in race-room.tsx). Spectators
watch a read-only WordStream fed by everyone's carets and are auto-seated by
`use-race.ts` when the room next returns to a lobby.

Player ids in snapshots are **masked per viewer** (`snapshotFor`): a player's id
is also their action credential, so only their own row carries the real one.
Progress and finish payloads are clamped server-side (`sanitizeResult` — the wpm
ceiling is derived from text length over server-measured elapsed time).

The `cheat` action is a deliberate easter egg, not a bug: typing "make me win"
mid-race ends the round and crowns the typist at 1337 wpm. Do not "fix" it.

Countdowns and the grace clock are sent as **relative** milliseconds
(`startInMs`, `graceInMs`), recomputed at send time, never as absolute
timestamps: two machines' wall clocks disagree by
seconds, so an absolute instant would need a clock-sync handshake to be fair.

## Race colours

`--sem-rival-1` … `-4` plus the brand purple are a five-slot categorical palette,
chosen by searching for the best worst-case *all-pairs* colourblind separation
rather than by eye — rival carets appear next to each other in any order, and an
earlier hand-picked set had a rose/green pair that was indistinguishable under
deuteranopia. If you change them, re-run the check for both surfaces; and keep
the name label on the rival caret, which is the secondary encoding that carries
identity when colour alone is not enough.
