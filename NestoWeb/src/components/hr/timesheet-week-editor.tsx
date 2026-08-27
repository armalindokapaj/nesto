"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTimesheetLinesAction, submitTimesheetAction } from "@/app/actions/hr-timesheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";
import { toActionError } from "@/lib/errors";

type DayLine = { date: string; projectId: string; hours: string };

// PRD_HR_Dashboard §Timesheets — one row per day of the week, an optional
// project per row (a line with no project is internal/non-billable time and
// is excluded from Project Labour, see hr-timesheets.ts).
export function TimesheetWeekEditor({
  timesheetId,
  weekStart,
  status,
  existingLines,
  projects,
}: {
  timesheetId: string;
  weekStart: string; // ISO date, Monday
  status: string;
  existingLines: { date: string; projectId: string | null; hours: number }[];
  projects: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const [lines, setLines] = useState<DayLine[]>(
    days.map((date) => {
      const existing = existingLines.find((l) => l.date.slice(0, 10) === date);
      return { date, projectId: existing?.projectId ?? "", hours: existing ? String(existing.hours) : "" };
    })
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const editable = status === "DRAFT" || status === "REJECTED";

  function updateLine(i: number, patch: Partial<DayLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function save(thenSubmit: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await saveTimesheetLinesAction(undefined, {
        timesheetId,
        lines: lines.filter((l) => l.hours && parseFloat(l.hours) > 0).map((l) => ({ date: l.date, projectId: l.projectId || undefined, hours: parseFloat(l.hours) })),
      });
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      if (thenSubmit) {
        try {
          await submitTimesheetAction(timesheetId);
        } catch (err) {
          setError(toActionError(err, "Could not submit."));
          return;
        }
      }
      router.refresh();
    });
  }

  const total = lines.reduce((sum, l) => sum + (parseFloat(l.hours) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={line.date} className="flex items-center gap-2">
            <span className="w-24 text-xs text-ink-muted">{new Date(line.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
            <select
              value={line.projectId}
              disabled={!editable}
              onChange={(e) => updateLine(i, { projectId: e.target.value })}
              className="h-9 flex-1 rounded-lg border border-border bg-surface px-2 text-sm text-ink disabled:opacity-60"
            >
              <option value="">{t("hrDashboard.internalNonBillable")}</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Input type="number" min="0" step="0.25" disabled={!editable} value={line.hours} onChange={(e) => updateLine(i, { hours: e.target.value })} className="w-20" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-muted">{t("hrDashboard.totalHours")}: <span className="font-semibold text-ink">{total}</span></span>
        {editable && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={isPending} onClick={() => save(false)}>{t("common.save")}</Button>
            <Button size="sm" disabled={isPending} onClick={() => save(true)}>{t("hrDashboard.submitTimesheet")}</Button>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
