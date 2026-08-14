"use client";

import { m } from "motion/react";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type CharStatus, locateCursor, type TestState } from "@/lib/engine";
import { raceColorBg, raceColorText } from "@/lib/race/types";
import type { CaretStyle, FontSize } from "@/lib/settings";
import { cn } from "@/lib/utils";

// The typing surface. Words are flex items so they wrap whole, and the block
// slides up a line at a time to keep the active word on the middle of three
// visible lines. Carets are measured from the DOM, not computed from char
// widths, so they land right across font loading, zoom, and overshoot chars.

// line-height pinned via the `/` syntax — Tailwind's text-* ships its own
// line-height that would beat a separate leading-* class
const FONT_SIZE_CLASS: Record<FontSize, string> = {
  sm: "text-xl/[1.6]",
  md: "text-2xl/[1.6]",
  lg: "text-3xl/[1.6]",
  xl: "text-4xl/[1.6]",
};

const CHAR_CLASS: Record<CharStatus, string> = {
  pending: "text-type-pending",
  correct: "text-type-correct",
  incorrect: "text-type-error",
  extra: "text-type-extra",
};

type CaretBox = { left: number; top: number; height: number };

/** a remote player's caret: char index + colour slot */
export type RivalCaret = {
  id: string;
  name: string;
  colorIndex: number;
  cursor: number;
};

type WordStreamProps = {
  state: TestState;
  caretStyle: CaretStyle;
  smoothCaret: boolean;
  fontSize: FontSize;
  blind: boolean;
  /** true for a moment after each keystroke; freezes the caret blink */
  typing: boolean;
  focused: boolean;
  /** other players' carets, drawn behind your own */
  rivals?: RivalCaret[];
};

// find a character's box in the laid-out stream (words carry data-word); the
// local caret and rival carets both go through here
function measureChar(container: HTMLElement, wordIndex: number, charIndex: number): CaretBox | null {
  const wordEl = container.querySelector<HTMLElement>(`[data-word="${wordIndex}"]`);
  if (!wordEl) return null;

  const chars = wordEl.children;

  if (charIndex < chars.length) {
    const el = chars[charIndex] as HTMLElement;
    return { left: el.offsetLeft, top: el.offsetTop, height: el.offsetHeight };
  }

  if (chars.length > 0) {
    // past the last char — park on its trailing edge
    const el = chars[chars.length - 1] as HTMLElement;
    return { left: el.offsetLeft + el.offsetWidth, top: el.offsetTop, height: el.offsetHeight };
  }

  return { left: wordEl.offsetLeft, top: wordEl.offsetTop, height: wordEl.offsetHeight };
}

export function WordStream({
  state,
  caretStyle,
  smoothCaret,
  fontSize,
  blind,
  typing,
  focused,
  rivals,
}: WordStreamProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState<CaretBox | null>(null);
  const [rivalBoxes, setRivalBoxes] = useState<{ rival: RivalCaret; box: CaretBox }[]>([]);
  const [scroll, setScroll] = useState(0);

  const { words, typed, wordIndex } = state;
  const typedLength = typed[wordIndex]?.length ?? 0;

  // a reflow (resize, font-size change) invalidates every measured position;
  // tracking the container's box is what re-runs the measurements below
  const [containerBox, setContainerBox] = useState("");

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerBox(`${Math.round(width)}x${Math.round(height)}`);
    });

    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  // re-measure on anything that moves the caret; layout effect so the caret
  // and its text paint in the same frame
  useLayoutEffect(() => {
    const inner = innerRef.current;
    // nothing to measure until the words have been laid out once
    if (!inner || !containerBox) return;

    const box = measureChar(inner, wordIndex, typedLength);
    if (!box) return;

    setCaret(box);
    // one line of context behind the active word, one ahead
    setScroll(Math.max(0, box.top - box.height));
  }, [typedLength, wordIndex, containerBox]);

  // rivals get their own pass — they move on network ticks, not your keystrokes
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner || !containerBox || !rivals || rivals.length === 0) {
      setRivalBoxes([]);
      return;
    }

    const measured: { rival: RivalCaret; box: CaretBox }[] = [];
    for (const rival of rivals) {
      const position = locateCursor(words, rival.cursor);
      const box = measureChar(inner, position.wordIndex, position.charIndex);
      if (box) measured.push({ rival, box });
    }
    setRivalBoxes(measured);
  }, [rivals, words, containerBox]);

  return (
    <div
      data-typing={typing}
      className={cn(
        "relative w-full overflow-hidden font-mono transition-[filter,opacity] duration-200",
        FONT_SIZE_CLASS[fontSize],
        // three lines at 1.6 line-height
        "h-[4.8em]",
        !focused && "opacity-40 blur-[3px]",
      )}
    >
      <m.div
        ref={innerRef}
        initial={false}
        animate={{ y: -scroll }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="relative flex flex-wrap gap-x-[1ch] gap-y-0"
      >
        {words.map((word, index) => (
          <Word
            // words repeat, so the index is the only stable identity
            // biome-ignore lint/suspicious/noArrayIndexKey: the list is fixed for the life of a test
            key={index}
            index={index}
            target={word}
            typed={typed[index] ?? ""}
            isPast={index < wordIndex}
            blind={blind}
          />
        ))}

        {/* rivals first, so your own caret paints on top */}
        {rivalBoxes.map(({ rival, box }) => (
          <RivalMarker key={rival.id} rival={rival} box={box} />
        ))}

        {caret && caretStyle !== "off" && <Caret box={caret} style={caretStyle} smooth={smoothCaret} />}
      </m.div>
    </div>
  );
}

type WordProps = {
  index: number;
  target: string;
  typed: string;
  isPast: boolean;
  blind: boolean;
};

// memoised: hundreds of words, and only the active one changes per keystroke
const Word = memo(function Word({ index, target, typed, isPast, blind }: WordProps) {
  const length = Math.max(target.length, typed.length);
  const chars: React.ReactNode[] = [];

  for (let i = 0; i < length; i++) {
    let status: CharStatus;

    if (i >= typed.length) {
      status = "pending";
    } else if (i >= target.length) {
      status = "extra";
    } else if (blind) {
      // blind mode: everything reads as correct until the results screen
      status = "correct";
    } else {
      status = typed[i] === target[i] ? "correct" : "incorrect";
    }

    chars.push(
      <span key={i} className={CHAR_CLASS[status]}>
        {i >= target.length ? typed[i] : target[i]}
      </span>,
    );
  }

  // words left behind with mistakes get a quiet underline
  const wasWrong = isPast && !blind && typed !== target;

  return (
    <div
      data-word={index}
      className={cn(
        "whitespace-nowrap",
        wasWrong && "underline decoration-2 decoration-type-error/60 underline-offset-[0.3em]",
      )}
    >
      {chars}
    </div>
  );
});

function Caret({ box, style, smooth }: { box: CaretBox; style: CaretStyle; smooth: boolean }) {
  // block and line sit on the text body; underline drops below the baseline
  const geometry =
    style === "underline"
      ? { width: "1ch", height: "2px", top: box.top + box.height * 0.82 }
      : { width: style === "block" ? "1ch" : "2px", height: box.height * 0.72, top: box.top + box.height * 0.14 };

  return (
    <m.span
      aria-hidden
      initial={false}
      animate={{ x: box.left, y: geometry.top }}
      transition={smooth ? { type: "spring", stiffness: 900, damping: 55, mass: 0.4 } : { duration: 0 }}
      style={{ width: geometry.width, height: geometry.height }}
      // the block caret covers its character, so it runs at low opacity
      className={cn(
        "pointer-events-none absolute top-0 left-0 rounded-[1px] bg-caret caret-blink",
        style === "block" && "opacity-35",
      )}
    />
  );
}

// coloured bar + name. the name isn't decoration — it carries identity when
// two colours are hard to tell apart, so don't drop it. the spring smooths
// the 10Hz position updates into something that reads as typing.
function RivalMarker({ rival, box }: { rival: RivalCaret; box: CaretBox }) {
  return (
    <m.span
      aria-hidden
      initial={false}
      animate={{ x: box.left, y: box.top }}
      transition={{ type: "spring", stiffness: 260, damping: 34, mass: 0.6 }}
      style={{ height: box.height }}
      className="pointer-events-none absolute top-0 left-0 flex w-0 flex-col items-start"
    >
      <span className={cn("absolute top-0 bottom-0 w-[2px] rounded-[1px] opacity-80", raceColorBg(rival.colorIndex))} />
      <span
        className={cn(
          "absolute -top-[0.55em] whitespace-nowrap font-sans text-[0.34em] leading-none tracking-wide",
          raceColorText(rival.colorIndex),
        )}
      >
        {rival.name}
      </span>
    </m.span>
  );
}
