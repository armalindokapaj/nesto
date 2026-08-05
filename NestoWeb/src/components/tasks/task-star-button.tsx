"use client";

import { useTransition } from "react";
import { Star } from "lucide-react";
import { toggleTaskStarAction } from "@/app/actions/tasks-module";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

// §14 Personal Star — private, never touches official priority/status, never
// notifies anyone else.
export function TaskStarButton({ taskId, starred, size = 15 }: { taskId: string; starred: boolean; size?: number }) {
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
          await toggleTaskStarAction(taskId);
        });
      }}
      aria-label={starred ? t("task.unstar") : t("task.star")}
      aria-pressed={starred}
      className={cn("shrink-0 transition-colors disabled:opacity-50", starred ? "text-gold" : "text-ink-faint hover:text-gold")}
    >
      <Star size={size} fill={starred ? "currentColor" : "none"} />
    </button>
  );
}
