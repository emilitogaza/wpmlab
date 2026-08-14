"use client";

import { useEffect, useRef, useState } from "react";
import { niceCeiling, smoothPath, xTicks, yTicks } from "@/lib/chart";
import { type RacePlayer, raceColorBg, raceColorStroke } from "@/lib/race/types";
import { cn } from "@/lib/utils";

// Every finisher's net wpm on one shared axis. Lines are direct-labelled at
// their ends as well as in the legend — with five hues, colour alone isn't
// enough to carry identity.

const HEIGHT = 260;
const PAD = { top: 16, right: 64, bottom: 28, left: 40 };

export function RaceChart({ players }: { players: RacePlayer[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const finished = players.filter((p) => p.result && p.result.samples.length >= 2);

  const plotWidth = Math.max(0, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const peak = Math.max(...finished.flatMap((p) => p.result?.samples.map((s) => s.wpm) ?? [0]), 10);
  const yMax = niceCeiling(peak);
  const lastSecond = Math.max(...finished.map((p) => p.result?.samples.length ?? 0), 1);

  const x = (second: number) => PAD.left + ((second - 1) / Math.max(1, lastSecond - 1)) * plotWidth;
  const y = (value: number) => PAD.top + plotHeight - (Math.min(value, yMax) / yMax) * plotHeight;

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-ink-dim text-xs">
        {finished.map((player) => (
          <span key={player.id} className="flex items-center gap-1.5">
            <span className={cn("h-0.5 w-4 rounded-full", raceColorBg(player.colorIndex))} />
            {player.name}
          </span>
        ))}
      </div>

      <div ref={containerRef} className="relative w-full">
        {width > 0 && finished.length > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label="Net typing speed per second for each racer">
            {yTicks(yMax).map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + plotWidth}
                  y1={y(tick)}
                  y2={y(tick)}
                  className="stroke-border"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-ink-faint text-[10px]"
                >
                  {tick}
                </text>
              </g>
            ))}

            {xTicks(lastSecond).map((second) => (
              <text
                key={second}
                x={x(second)}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-ink-faint text-[10px]"
              >
                {second}
              </text>
            ))}

            {finished.map((player) => {
              const samples = player.result?.samples ?? [];
              const end = samples[samples.length - 1];

              return (
                <g key={player.id}>
                  <path
                    d={smoothPath(samples.map((s) => [x(s.second), y(s.wpm)]))}
                    fill="none"
                    strokeWidth={2}
                    strokeLinecap="round"
                    className={raceColorStroke(player.colorIndex)}
                  />
                  {end && (
                    // direct label in text ink — the stroke carries the colour
                    <text
                      x={x(end.second) + 8}
                      y={y(end.wpm)}
                      dominantBaseline="middle"
                      className="fill-ink-dim text-[10px]"
                    >
                      {player.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {width > 0 && finished.length === 0 && (
          <div style={{ height: HEIGHT }} className="flex items-center justify-center text-ink-faint text-sm">
            no finished runs to plot
          </div>
        )}
      </div>
    </div>
  );
}
