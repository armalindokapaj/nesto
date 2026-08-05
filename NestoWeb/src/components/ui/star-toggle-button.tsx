"use client";

import { useTransition } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared by the per-user Star toggle on Documents, Tasks and Clients (each
// module's own PRD calls it a private preference: never touches the
// record's official status, never notifies anyone). The three call sites
// differ only in which server action they call and their i18n label, so
// this owns the visual/interaction contract once instead of three times.
export function StarToggleButton({
  starred,
  onToggle,
  starLabel,
  unstarLabel,
  size = 15,
}: {
  starred: boolean;
  onToggle: () => Promise<unknown>;
  starLabel: string;
  unstarLabel: string;
  size?: number;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          await onToggle();
        });
      }}
      aria-label={starred ? unstarLabel : starLabel}
      aria-pressed={starred}
      className={cn("shrink-0 transition-colors disabled:opacity-50", starred ? "text-gold" : "text-ink-faint hover:text-gold")}
    >
      <Star size={size} fill={starred ? "currentColor" : "none"} />
    </button>
  );
}
