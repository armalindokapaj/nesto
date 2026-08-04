"use client";

import { useTransition } from "react";
import { updateWorkPackageProgressAction } from "@/app/actions/project-work-packages";
import { WORK_PACKAGE_STATUSES, WORK_PACKAGE_STATUS_KEY } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/locale-provider";

export function WorkPackageStatusControl({
  projectId,
  workPackageId,
  status,
  progressPct,
}: {
  projectId: string;
  workPackageId: string;
  status: string;
  progressPct: number;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 shrink-0">
      <input
        type="number"
        min={0}
        max={100}
        defaultValue={progressPct}
        disabled={pending}
        onBlur={(e) => {
          const next = Math.min(100, Math.max(0, Number(e.target.value) || 0));
          startTransition(() => updateWorkPackageProgressAction(projectId, workPackageId, { progressPct: next }));
        }}
        className="h-8 w-16 rounded-md border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      />
      <select
        defaultValue={status}
        disabled={pending}
        onChange={(e) => startTransition(() => updateWorkPackageProgressAction(projectId, workPackageId, { status: e.target.value }))}
        className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      >
        {WORK_PACKAGE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(WORK_PACKAGE_STATUS_KEY[s])}
          </option>
        ))}
      </select>
    </div>
  );
}
