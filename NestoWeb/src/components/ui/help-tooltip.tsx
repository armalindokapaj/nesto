"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { HelpCircle } from "lucide-react";

// Section 33's contextual "?" help system: a small icon next to a non-obvious
// label/field. Desktop shows a hover/focus tooltip; the same trigger works
// with keyboard focus and is announced to screen readers via aria-label.
export function HelpTooltip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label="More information"
            className="inline-flex items-center justify-center text-ink-faint hover:text-gold transition-colors duration-[var(--motion-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 rounded-full"
          >
            <HelpCircle size={13} />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            sideOffset={6}
            className="max-w-[240px] rounded-lg border border-border bg-ink px-3 py-2 text-xs leading-relaxed text-white shadow-lg z-50"
          >
            {children}
            <TooltipPrimitive.Arrow className="fill-ink" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
