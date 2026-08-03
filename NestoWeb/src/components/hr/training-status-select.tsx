"use client";

import { useTransition } from "react";
import { updateTrainingStatusAction } from "@/app/actions/training";
import { useI18n } from "@/lib/i18n/locale-provider";

const STATUSES = ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "EXPIRED"] as const;

export function TrainingStatusSelect({
  trainingId,
  employeeId,
  status,
}: {
  trainingId: string;
  employeeId: string;
  status: string;
}) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={isPending}
      onChange={(e) =>
        startTransition(() => updateTrainingStatusAction(trainingId, employeeId, e.target.value as (typeof STATUSES)[number]))
      }
      className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-50"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(`hr_sub.trainingStatus${s}`)}
        </option>
      ))}
    </select>
  );
}
