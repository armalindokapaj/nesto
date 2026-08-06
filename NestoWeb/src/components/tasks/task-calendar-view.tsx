import Link from "next/link";
import { getT } from "@/lib/i18n/server";

type CalendarTask = { id: string; code: string; title: string; status: string; priority: string; dueDate: Date | null };

const DAY_KEYS = ["calendar.sun", "calendar.mon", "calendar.tue", "calendar.wed", "calendar.thu", "calendar.fri", "calendar.sat"];

function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const startOffset = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (Date | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(Date.UTC(year, month, i + 1)))];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// PRD_Tasks_Module — Calendar layout, a real month grid keyed off Task.dueDate
// (no separate scheduling model exists yet, so this reads the one date every
// task already has). Undated tasks are listed separately below the grid
// rather than silently dropped.
export async function TaskCalendarView({ tasks, year, month }: { tasks: CalendarTask[]; year: number; month: number }) {
  const { t } = await getT();
  const cells = monthGrid(year, month);
  const byDay = new Map<string, CalendarTask[]>();
  const undated: CalendarTask[] = [];
  for (const task of tasks) {
    if (!task.dueDate) { undated.push(task); continue; }
    const d = new Date(task.dueDate);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    byDay.set(key, [...(byDay.get(key) ?? []), task]);
  }
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  const prev = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const next = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{monthLabel}</h3>
        <div className="flex gap-2">
          <Link href={`/tasks?layout=calendar&year=${prev.y}&month=${prev.m}`} className="rounded-lg border border-border px-3 py-1 text-xs text-ink-muted hover:text-ink">‹</Link>
          <Link href={`/tasks?layout=calendar&year=${next.y}&month=${next.m}`} className="rounded-lg border border-border px-3 py-1 text-xs text-ink-muted hover:text-ink">›</Link>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-[0.68rem]">
        {DAY_KEYS.map((k) => <div key={k} className="bg-surface-sunken px-2 py-1.5 text-center font-semibold text-ink-faint">{t(k)}</div>)}
        {cells.map((date, i) => {
          const key = date ? `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}` : `blank-${i}`;
          const dayTasks = date ? byDay.get(key) ?? [] : [];
          return (
            <div key={key} className="min-h-24 bg-surface p-1.5">
              {date && <p className="mb-1 text-ink-faint">{date.getUTCDate()}</p>}
              {dayTasks.slice(0, 3).map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`} className="mb-1 block truncate rounded bg-gold-soft px-1.5 py-0.5 text-gold-deep hover:bg-gold/20">
                  {task.title}
                </Link>
              ))}
              {dayTasks.length > 3 && <p className="text-ink-faint">+{dayTasks.length - 3}</p>}
            </div>
          );
        })}
      </div>
      {undated.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("tasksPage.noDueDate")}</h4>
          <div className="flex flex-wrap gap-2">
            {undated.map((task) => (
              <Link key={task.id} href={`/tasks/${task.id}`} className="rounded-full border border-border px-3 py-1 text-xs text-ink-muted hover:text-ink">
                {task.title}
              </Link>
            ))}
          </div>
        </div>
      )}
      {tasks.length === 0 && <p className="py-8 text-center text-sm text-ink-faint">{t("task.noTasks")}</p>}
    </div>
  );
}
