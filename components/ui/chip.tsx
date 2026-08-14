"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The toggle pattern from the config bar: a rounded tray of flat text buttons
 * that carry no border or background of their own and simply light up in the
 * brand colour when active. Cheap to scan, and it keeps the bar quiet while
 * you are actually typing.
 */

export function ChipGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-1 rounded-2 bg-fill-raised px-2 py-1.5 font-mono text-sm", className)}
      {...props}
    />
  );
}

export function ChipDivider() {
  return <span aria-hidden className="mx-1 h-4 w-px bg-fill-strong" />;
}

type ChipProps = React.ComponentProps<"button"> & {
  active?: boolean;
  icon?: React.ReactNode;
};

export function Chip({ className, active = false, icon, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      data-active={active}
      // aria-pressed rather than a role change: these really are toggles, and a
      // screen reader should hear the state, not just see the colour.
      aria-pressed={active}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-1_5 px-2.5 py-1 transition-colors",
        "text-ink-faint hover:text-ink-dim",
        "focus-visible:outline-2 focus-visible:outline-brand/60 focus-visible:outline-offset-1",
        active && "text-brand-ink hover:text-brand-ink",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
