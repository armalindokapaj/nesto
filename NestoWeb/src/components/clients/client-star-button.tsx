"use client";

import { useTransition } from "react";
import { Star } from "lucide-react";
import { toggleClientStarAction } from "@/app/actions/crm-module";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ClientStarButton({ clientId, starred, size = 15 }: { clientId: string; starred: boolean; size?: number }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          await toggleClientStarAction(clientId);
        });
      }}
      aria-label={starred ? t("crm.unstar") : t("crm.star")}
      aria-pressed={starred}
      className={cn("shrink-0 transition-colors disabled:opacity-50", starred ? "text-gold" : "text-ink-faint hover:text-gold")}
    >
      <Star size={size} fill={starred ? "currentColor" : "none"} />
    </button>
  );
}
