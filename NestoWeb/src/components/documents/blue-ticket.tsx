"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { BadgeCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { ActorSnapshot } from "@/lib/actor-snapshot";

// PRD_18 §13 Figure 5 — the Blue Ticket: a small always-visible marker next
// to an approved revision. Hovering/focusing reveals the approver's frozen
// identity snapshot, so it stays accurate even if that person's role or
// company changes later.
export function BlueTicket({
  approverSnapshot,
  comment,
  approvedAt,
}: {
  approverSnapshot: ActorSnapshot;
  comment?: string | null;
  approvedAt: Date | string;
}) {
  const { t } = useI18n();
  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label={t("documents.blueTicket")}
            className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-xs font-medium text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40"
          >
            <BadgeCheck size={13} /> {t("documents.blueTicket")}
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            sideOffset={6}
            className="z-50 max-w-[260px] rounded-lg border border-info/30 bg-surface px-3 py-2.5 text-xs leading-relaxed text-ink shadow-lg"
          >
            <p className="font-semibold text-ink">{approverSnapshot.name}</p>
            <p className="text-ink-muted">
              {[approverSnapshot.position, approverSnapshot.department].filter(Boolean).join(" · ") || approverSnapshot.role}
            </p>
            <p className="text-ink-muted">{approverSnapshot.companyName}</p>
            <p className="mt-1.5 text-ink-faint">
              {formatDate(approvedAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
            {comment && <p className="mt-1.5 italic text-ink-muted">&ldquo;{comment}&rdquo;</p>}
            <TooltipPrimitive.Arrow className="fill-surface" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
