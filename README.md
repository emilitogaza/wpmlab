# wpmlab

A typing-speed practice tool. Time, word-count, and quote tests; live wpm and accuracy; a per-second breakdown of every run; and a link-shareable race for up to five players.

Inspired by the excellent [monkeytype](https://monkeytype.com) — the minimal test-first layout is very much a homage — but built from scratch, with its own settings (exact mode above all) and online racing. Not affiliated with monkeytype in any way.

```bash
pnpm dev
```

## Settings

**Exact mode** is the one the app was built around — TypeRacer rules. On: a wrong key is rejected and the caret stays put, so you must type every character correctly to proceed; the rejected press still counts against accuracy. Off: type straight through mistakes, they turn red, and wpm (correct characters only) and accuracy are reported side by side instead of one hiding in the other.

The rest, in the settings dialog: **confidence mode** (no backspace), **freedom backspace** (edit words you already got right), **blind mode** (no feedback until the end), caret style, live wpm/accuracy/progress, keypress sound, font size, and your racing name.

## Layout

| Path | What lives there |
| --- | --- |
| `lib/engine.ts` | The typing engine — a pure reducer over keystrokes. No DOM, no timers, no React, no clock reads. |
| `lib/stats.ts` | wpm / raw / accuracy / consistency, and per-second sampling. |
| `lib/words.ts` | Word lists, punctuation and number modifiers, quotes, seeded generation. |
| `lib/use-typing-test.ts` | The React binding — everything impure: wall clock, sampling interval, sample buffer. |
| `lib/settings.ts` | Persisted user settings, with validation on read. |
| `lib/race/` | Race protocol, in-memory room store, and the client connection. |
| `app/globals.css` | Every design token. Read it before styling anything. |

Conventions — the design system, the motion setup, and the no-shadcn rule — are in [AGENTS.md](AGENTS.md).

## Racing

Hit **race a friend** under the typing surface. That creates a room, drops you in
its lobby, and gives you a link to send. Up to five players; the host picks the
config and starts; five-second countdown; everyone types identical text with the
others' carets moving through it in their own colours, plus live standings. At
the end you get a leaderboard and every racer's speed curve on one chart.

**Arrive late (or reload mid-race) and you spectate**: a live read-only view of
the text with every racer's caret, plus the standings. When the round ends you
see the results, and the next lobby seats you automatically.

**Nobody can stall the room.** When the first player crosses the line, everyone
else gets 15 seconds. Each remaining client finishes its own run on that
deadline so it still scores a real partial result; the server force-finishes
anyone whose tab is gone or asleep, and they land on the leaderboard with a
dash. A player who disconnects mid-race never blocks the finish either.

Two tabs on the same machine work for testing — player identity is per-tab
(sessionStorage), though the display name is shared per-origin.

### Deploying it

Room state lives **in the server process's memory**. No database, no realtime
service, no accounts — but it means the app has to run as **one long-lived
instance**: `next start`, a container, a VPS, Railway, Fly, Render.

On a serverless platform that spreads requests across instances (Vercel's
default), two players land in two different memories and never see each other.
If you need that, `lib/race/store.ts` is reached only through `applyAction`, so
swapping it for a Cloudflare Durable Object or a Redis-backed store is a
contained change. Rooms are also lost on restart and reaped after an hour idle.

Transport is server-sent events down and plain POSTs up, at 10Hz per player.

To race someone on your wifi, give them your LAN address rather than
`localhost` — `next.config.ts` already allows private ranges as dev origins.

### Why it's cheap to have

Three invariants in the solo engine did the work:

1. `generateWords(config, seed)` is deterministic, so the text is never sent —
   just the seed.
2. `cursorIndex(state)` reduces a player's position to one integer, and
   `locateCursor` turns it back into a place to draw.
3. `applyKey` and `beginTest` take an explicit timestamp, so every player's
   clock can start on the same instant.

## Checks

```bash
pnpm check && pnpm typecheck && pnpm lint && pnpm build
```
