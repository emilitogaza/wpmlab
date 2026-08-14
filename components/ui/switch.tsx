"use client";

import { m } from "motion/react";
import { Switch as SwitchPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

// Track is 36x20 with no border; the 16px thumb sits at x=2 / x=18 so the
// gap is exactly 2px on every side in both states.
const THUMB_X_UNCHECKED = 2;
const THUMB_X_CHECKED = 18;

function Switch({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false);
  const isChecked = checked ?? internalChecked;

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={(next) => {
        setInternalChecked(next);
        onCheckedChange?.(next);
      }}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full shadow-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-brand/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-brand-fill data-[state=unchecked]:bg-fill-strong",
        className,
      )}
      {...props}
    >
      {/* plain motion span, not SwitchPrimitive.Thumb — the Radix asChild Slot
          breaks Motion's animate updates, and the thumb is purely visual */}
      <m.span
        data-slot="switch-thumb"
        data-state={isChecked ? "checked" : "unchecked"}
        initial={false}
        animate={{ x: isChecked ? THUMB_X_CHECKED : THUMB_X_UNCHECKED }}
        transition={{ type: "spring", stiffness: 600, damping: 28 }}
        className="pointer-events-none block size-4 rounded-full bg-fill-light"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
