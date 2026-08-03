"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AgendaEventDialog } from "@/components/calendar/agenda-event-dialog";
import { cn } from "@/lib/utils";
import { CALENDAR_ITEM_TONE } from "@/lib/constants";
import type { CalendarItemSource } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/locale-provider";

type CalendarItem = {
  id: string;
  source: CalendarItemSource;
  sourceId: string;
  title: string;
  subtitle?: string;
  date: string | Date;
  href: string;
  agendaDetail?: { endAt: string | Date | null; location: string | null; notes: string | null };
};

const TONE_CHIP_CLASSES: Record<string, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-sunken text-ink-muted",
  gold: "bg-gold-soft text-gold-strong",
};

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// PRD_9 CAL-001..CAL-004 — one combined month grid; every non-agenda chip is
// a plain <Link> to its item's own source-of-truth record (CAL-004), agenda
// chips open the inline edit dialog instead since they have no other home.
export function PersonalMonthCalendar({ year, month, items }: { year: number; month: number; items: CalendarItem[] }) {
  const { t, locale } = useI18n();
  const today = new Date();

  const firstOfMonth = new Date(year, month, 1);
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const monthLabel = firstOfMonth.toLocaleDateString(locale === "sq" ? "sq-AL" : "en-GB", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <p className="text-sm font-semibold text-ink capitalize">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <Link
            href={`/calendar?month=${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`}
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </Link>
          <Link
            href={`/calendar?month=${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`}
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
            aria-label="Next month"
          >
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_KEYS.map((wd) => (
          <div key={wd} className="px-1 py-1 text-center text-[0.6rem] font-semibold uppercase tracking-wide text-ink-faint">
            {t(`hr_sub.weekday.${wd}`)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[64px] border-b border-r border-border bg-surface-sunken/30" />;

          const dayItems = items.filter((it) => sameDay(new Date(it.date), day));
          const isToday = sameDay(day, today);

          return (
            <div
              key={i}
              className={cn(
                "min-h-[64px] border-b border-r border-border p-1 flex flex-col gap-0.5",
                (i + 1) % 7 === 0 && "border-r-0"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-[0.7rem] font-medium h-4 w-4 flex items-center justify-center rounded-full",
                    isToday ? "bg-gold text-white" : "text-ink-muted"
                  )}
                >
                  {day.getDate()}
                </span>
                <AgendaEventDialog defaultDate={new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0)} triggerVariant="icon" />
              </div>

              {dayItems.slice(0, 2).map((it) =>
                it.source === "AGENDA" ? (
                  <AgendaEventDialog
                    key={it.id}
                    triggerVariant="chip"
                    event={{
                      id: it.sourceId,
                      title: it.title,
                      startAt: it.date,
                      endAt: it.agendaDetail?.endAt ?? null,
                      location: it.agendaDetail?.location ?? null,
                      notes: it.agendaDetail?.notes ?? null,
                    }}
                  />
                ) : (
                  <Link
                    key={it.id}
                    href={it.href}
                    className={cn("truncate rounded px-1 py-0.5 text-[0.6rem] font-medium leading-tight", TONE_CHIP_CLASSES[CALENDAR_ITEM_TONE[it.source]])}
                    title={it.subtitle ? `${it.title} — ${it.subtitle}` : it.title}
                  >
                    {it.title}
                  </Link>
                )
              )}
              {dayItems.length > 2 && <p className="text-[0.55rem] text-ink-faint px-1">+{dayItems.length - 2} {t("hr_sub.more")}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
