"use client";

import { useEffect, useId, useRef, useState } from "react";
import { niceCeiling, smoothPath, xTicks, yTicks } from "@/lib/chart";
import type { Sample } from "@/lib/stats";
import { cn } from "@/lib/utils";

// Speed over the course of the test. Single-axis on purpose: net and raw wpm
// share a unit, and errors are a count — drawn as × glyphs on the raw line
// rather than on a misleading second y-axis.

const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

type ResultsChartProps = {
  samples: Sample[];
};

export function ResultsChart({ samples }: ResultsChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const plotWidth = Math.max(0, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  // under two seconds there's nothing to plot
  const enoughToPlot = samples.length >= 2 && width > 0;

  const peak = Math.max(...samples.map((s) => Math.max(s.wpm, s.raw)), 10);
  const yMax = niceCeiling(peak);
  const lastSecond = samples[samples.length - 1]?.second ?? 1;

  const x = (second: number) => PAD.left + ((second - 1) / Math.max(1, lastSecond - 1)) * plotWidth;
  const y = (value: number) => PAD.top + plotHeight - (Math.min(value, yMax) / yMax) * plotHeight;

  const ticks = yTicks(yMax);
  const active = hover === null ? null : samples[hover];

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Legend />
        <button
          type="button"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((v) => !v)}
          className="cursor-pointer rounded-1_5 px-2 py-1 text-ink-faint text-xs transition-colors hover:bg-fill-muted hover:text-ink"
        >
          {showTable ? "hide data" : "show data"}
        </button>
      </div>

      <div ref={containerRef} className="relative w-full">
        {enoughToPlot && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Typing speed over ${lastSecond} seconds. Net speed ended at ${Math.round(
              samples[samples.length - 1].wpm,
            )} words per minute.`}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const ratio = (event.clientX - rect.left - PAD.left) / Math.max(1, plotWidth);
              const index = Math.round(ratio * (samples.length - 1));
              setHover(Math.max(0, Math.min(samples.length - 1, index)));
            }}
          >
            {/* horizontal grid only — vertical lines would fight the crosshair */}
            {ticks.map((tick) => (
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

            {/* context first, emphasis on top */}
            <path
              d={smoothPath(samples.map((s) => [x(s.second), y(s.raw)]))}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              className="stroke-series-raw"
            />
            <path
              d={smoothPath(samples.map((s) => [x(s.second), y(s.wpm)]))}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              className="stroke-series-wpm"
            />

            {/* error glyphs on the raw line — shape carries the identity */}
            {samples
              .filter((s) => s.errors > 0)
              .map((s) => (
                <ErrorMark key={s.second} x={x(s.second)} y={y(s.raw)} count={s.errors} />
              ))}

            {active && (
              <g pointerEvents="none">
                <line
                  x1={x(active.second)}
                  x2={x(active.second)}
                  y1={PAD.top}
                  y2={PAD.top + plotHeight}
                  className="stroke-ink-faint"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle cx={x(active.second)} cy={y(active.raw)} r={4} className="fill-series-raw" />
                <circle cx={x(active.second)} cy={y(active.wpm)} r={4} className="fill-series-wpm" />
              </g>
            )}
          </svg>
        )}

        {!enoughToPlot && width > 0 && (
          <div style={{ height: HEIGHT }} className="flex items-center justify-center text-ink-faint text-sm">
            too short to plot
          </div>
        )}

        {active && (
          <div
            // flips left past the midpoint so it stays on the card
            style={{
              left: x(active.second),
              transform: `translateX(${x(active.second) > PAD.left + plotWidth / 2 ? "calc(-100% - 12px)" : "12px"})`,
            }}
            className="pointer-events-none absolute top-4 rounded-2 border border-border bg-fill-raised px-3 py-2 text-xs shadow-lg"
          >
            <div className="mb-1 text-ink-dim">{active.second}s</div>
            <TooltipRow swatch="bg-series-wpm" label="wpm" value={Math.round(active.wpm)} />
            <TooltipRow swatch="bg-series-raw" label="raw" value={Math.round(active.raw)} />
            {active.errors > 0 && <TooltipRow swatch="bg-series-error" label="errors" value={active.errors} />}
          </div>
        )}
      </div>

      {showTable && (
        <div id={tableId} className="mt-3 max-h-56 overflow-auto rounded-2 border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-fill-raised text-ink-dim">
              <tr>
                <Th>second</Th>
                <Th>wpm</Th>
                <Th>raw</Th>
                <Th>errors</Th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => (
                <tr key={sample.second} className="border-border border-t">
                  <Td>{sample.second}</Td>
                  <Td>{Math.round(sample.wpm)}</Td>
                  <Td>{Math.round(sample.raw)}</Td>
                  <Td>{sample.errors || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-3 py-1.5 text-left font-normal">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-1.5 text-ink-dim">{children}</td>;
}

function TooltipRow({ swatch, label, value }: { swatch: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2 rounded-full", swatch)} />
      <span className="text-ink-dim">{label}</span>
      <span className="ml-auto pl-3 text-ink">{value}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-ink-dim text-xs">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded-full bg-series-wpm" />
        wpm
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded-full bg-series-raw" />
        raw
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="10" height="10" viewBox="-5 -5 10 10" aria-hidden className="stroke-series-error">
          {/* decorative, but a <title> keeps the linter's SVG rule happy */}
          <title>Error marker</title>
          <path d="M-3-3 3 3M3-3-3 3" strokeWidth={2} strokeLinecap="round" />
        </svg>
        errors
      </span>
    </div>
  );
}

function ErrorMark({ x, y, count }: { x: number; y: number; count: number }) {
  // grows a little with the count, capped
  const size = Math.min(4 + count, 8);
  return (
    <g className="stroke-series-error" strokeWidth={2} strokeLinecap="round">
      <path d={`M${x - size} ${y - size}L${x + size} ${y + size}M${x + size} ${y - size}L${x - size} ${y + size}`} />
    </g>
  );
}
