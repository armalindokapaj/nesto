"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { CreateAppointmentDialog } from "@/components/hr/calendar/create-appointment-dialog";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

type LeaveEntry = {
  id: string;
  startDate: string | Date;
  endDate: string | Date;
  employee: { id: string; fullName: string; avatarColor: string };
};

type Appointment = {
  id: string;
  title: string;
  type: string;
  candidateName: string | null;
  scheduledAt: string | Date;
};

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isWithin(day: Date, start: Date, end: Date) {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return d >= s && d <= e;
}

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function MonthCalendar({
  year,
  month,
  leaveEntries,
  appointments,
  canCreate,
}: {
  year: number;
  month: number;
  leaveEntries: LeaveEntry[];
  appointments: Appointment[];
  canCreate: boolean;
}) {
  const { t, locale } = useI18n();
  const today = new Date();

  const firstOfMonth = new Date(year, month, 1);
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const monthLabel = firstOfMonth.toLocaleDateString(locale === "sq" ? "sq-AL" : "en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold text-ink capitalize">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <Link
            href={`/dashboard/hr/calendar?month=${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </Link>
          <Link
            href={`/dashboard/hr/calendar?month=${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_KEYS.map((wd) => (
          <div key={wd} className="px-2 py-2 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-ink-faint">
            {t(`hr_sub.weekday.${wd}`)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[104px] border-b border-r border-border bg-surface-sunken/30" />;

          const dayLeave = leaveEntries.filter((l) => isWithin(day, new Date(l.startDate), new Date(l.endDate)));
          const dayAppointments = appointments.filter((a) => sameDay(new Date(a.scheduledAt), day));
          const isToday = sameDay(day, today);

          return (
            <div
              key={i}
              className={cn(
                "min-h-[104px] border-b border-r border-border p-1.5 flex flex-col gap-1",
                (i + 1) % 7 === 0 && "border-r-0"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full",
                    isToday ? "bg-gold text-white" : "text-ink-muted"
                  )}
                >
                  {day.getDate()}
                </span>
                {canCreate && <CreateAppointmentDialog defaultDate={new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0)} triggerVariant="icon" />}
              </div>

              {dayLeave.length > 0 && (
                <div className="flex flex-wrap gap-0.5" title={dayLeave.map((l) => l.employee.fullName).join(", ")}>
                  {dayLeave.slice(0, 4).map((l) => (
                    <Avatar key={l.id} name={l.employee.fullName} color={l.employee.avatarColor} size={18} />
                  ))}
                  {dayLeave.length > 4 && <span className="text-[0.6rem] text-ink-faint self-center">+{dayLeave.length - 4}</span>}
                </div>
              )}

              {dayAppointments.slice(0, 2).map((a) => (
                <p
                  key={a.id}
                  className={cn(
                    "truncate rounded px-1 py-0.5 text-[0.65rem] font-medium",
                    a.type === "INTERVIEW" ? "bg-info-soft text-info" : "bg-surface-sunken text-ink-muted"
                  )}
                  title={a.candidateName ? `${a.title} — ${a.candidateName}` : a.title}
                >
                  {a.title}
                </p>
              ))}
              {dayAppointments.length > 2 && (
                <p className="text-[0.6rem] text-ink-faint px-1">+{dayAppointments.length - 2} {t("hr_sub.more")}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
