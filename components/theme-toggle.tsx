"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { IconButton } from "@/components/ui/icon-button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <IconButton
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* both render, CSS picks one — swapping on resolvedTheme would flash
          the wrong glyph before next-themes hydrates */}
      <Sun className="icon-4 dark:hidden" />
      <Moon className="icon-4 hidden dark:block" />
    </IconButton>
  );
}
