"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";

/** flat square button for header/toolbar icons — no fill until hover */
export function IconButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex size-8 cursor-pointer items-center justify-center rounded-1_5 text-ink-faint transition-colors",
        "hover:bg-fill-muted hover:text-ink",
        "focus-visible:outline-2 focus-visible:outline-brand/60 focus-visible:outline-offset-1",
        className,
      )}
      {...props}
    />
  );
}
