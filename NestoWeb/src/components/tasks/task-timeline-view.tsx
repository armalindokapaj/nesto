import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

type TimelineTask = { id: string; code: string; title: string; status: string; dueDate: Date | null; startDate?: Date | null };

const DAY_MS = 24 * 60 * 60 * 1000;

function dayIndex(date: Date, from: Date) {
  return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())) / DAY_MS);
}

const STATUS_BAR: Record<string, string> = {
  COMPLETED: "bg-success",
  OVERDUE: "bg-danger",
  BLOCKED: "bg-danger",
  IN_PROGRESS: "bg-gold",
};

// PRD_Tasks_Module — Timeline (Gantt-lite) layout. No separate scheduling
// model exists for plain tasks, so this reads startDate/dueDate straight off
// Task (the same PRD_4 orchestration fields the Calendar layout's dueDate
// comes from) — a real single-day marker when only dueDate is set, a real
// bar when both are. A 6-week rolling window (2 weeks back, 4 forward) keeps
// the grid a fixed, readable width rather than spanning a project's whole
// lifetime.
export async function TaskTimelineView({ tasks }: { tasks: TimelineTask[] }) {
  const { t } = await getT();
  const today = new Date();
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 14));
  const totalDays = 42;
  const dated = tasks.filter((tk) => tk.dueDate).sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()));
  const undated = tasks.filter((tk) => !tk.dueDate);

  const weekStarts = Array.from({ length: 6 }, (_, i) => new Date(from.getTime() + i * 7 * DAY_MS));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <div className="min-w-[760px]">
          <div className="grid" style={{ gridTemplateColumns: `200px repeat(${totalDays}, 1fr)` }}>
            <div className="border-b border-border p-2 text-xs font-medium text-ink-faint">{t("task.title")}</div>
            {weekStarts.map((w, i) => (
              <div key={i} className="col-span-7 border-b border-l border-border p-2 text-xs text-ink-faint">
                {w.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}
              </div>
            ))}
          </div>
          {dated.map((tk) => {
            const dueIdx = dayIndex(tk.dueDate!, from);
            const startIdx = tk.startDate ? dayIndex(tk.startDate, from) : dueIdx;
            const clampedStart = Math.max(0, Math.min(startIdx, totalDays - 1));
            const clampedEnd = Math.max(clampedStart, Math.min(dueIdx, totalDays - 1));
            const inRange = dueIdx >= 0 && dueIdx < totalDays;
            return (
              <div key={tk.id} className="grid items-center" style={{ gridTemplateColumns: `200px repeat(${totalDays}, 1fr)` }}>
                <div className="truncate border-b border-border p-2 text-sm">
                  <Link href={`/tasks/${tk.id}`} className="text-ink hover:text-gold">{tk.title}</Link>
                </div>
                <div className="col-span-full relative h-8 border-b border-border" style={{ gridColumn: `2 / span ${totalDays}` }}>
                  {inRange && (
                    <div
                      className={cn("absolute top-1.5 h-5 rounded-full", STATUS_BAR[tk.status] ?? "bg-ink-faint")}
                      style={{ left: `${(clampedStart / totalDays) * 100}%`, width: `${Math.max(2, ((clampedEnd - clampedStart + 1) / totalDays) * 100)}%` }}
                      title={`${tk.code} — ${t(`task.${tk.status.toLowerCase()}`) ?? tk.status}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
          {dated.length === 0 && <p className="p-6 text-center text-sm text-ink-faint">{t("task.noTasks")}</p>}
        </div>
      </div>

      {undated.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-2 text-xs font-medium text-ink-faint">{t("tasksPage.undatedTasks")}</p>
          <ul className="space-y-1.5">
            {undated.map((tk) => (
              <li key={tk.id}>
                <Link href={`/tasks/${tk.id}`} className="text-sm text-ink hover:text-gold">{tk.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
