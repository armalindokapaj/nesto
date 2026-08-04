"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleProjectPinAction } from "@/app/actions/projects";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

// PRD_Rework_1 PROJ-003 — pinning is per-user and independent of other
// users' pins; optimistic toggle so the star responds immediately, reverted
// only if the server action throws.
//
// PRD_Projects "Pin affordance" — on the overview grid the control must not
// add permanent visual clutter: it only appears on hover/focus, except once
// a project IS pinned, where it stays visible so the state itself is legible.
// `hoverOnly` opts into that; other call sites (e.g. the Project Header,
// a single prominent action) keep it always visible.
export function PinButton({
  projectId,
  pinned,
  size = 16,
  className,
  hoverOnly = false,
}: {
  projectId: string;
  pinned: boolean;
  size?: number;
  className?: string;
  hoverOnly?: boolean;
}) {
  const { t } = useI18n();
  const [isPinned, setIsPinned] = useState(pinned);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={isPinned}
      aria-label={isPinned ? t("projects.unpin") : t("projects.pin")}
      title={isPinned ? t("projects.unpin") : t("projects.pin")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !isPinned;
        setIsPinned(next);
        startTransition(async () => {
          try {
            await toggleProjectPinAction(projectId);
          } catch {
            setIsPinned(!next);
          }
        });
      }}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 backdrop-blur-sm border border-border shadow-sm transition-colors hover:bg-surface disabled:opacity-60",
        hoverOnly && !isPinned && "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
        className
      )}
    >
      <Star size={size} className={isPinned ? "fill-gold text-gold" : "text-ink-faint"} />
    </button>
  );
}
