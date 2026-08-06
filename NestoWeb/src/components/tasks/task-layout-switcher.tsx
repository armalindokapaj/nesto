"use client";

// PRD_Tasks_Module — Tasks Module Page ships all 4 layouts (List, Board,
// Calendar, Timeline). Layout choice lives in the URL (?layout=) so
// filters/scope survive a switch, per the PRD's "preserved across layout
// switches" rule; a saved view (TaskSavedView) can additionally persist a
// layout+filter combination server-side per user.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { List, LayoutGrid, CalendarDays, GanttChartSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

const LAYOUTS = [
  ["list", List, "tasksPage.layoutList"],
  ["board", LayoutGrid, "tasksPage.layoutBoard"],
  ["calendar", CalendarDays, "tasksPage.layoutCalendar"],
  ["timeline", GanttChartSquare, "tasksPage.layoutTimeline"],
] as const;

export function TaskLayoutSwitcher() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const active = searchParams.get("layout") ?? "list";

  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-1">
      {LAYOUTS.map(([key, Icon, labelKey]) => {
        const params = new URLSearchParams(searchParams.toString());
        if (key === "list") params.delete("layout");
        else params.set("layout", key);
        const href = `/tasks${params.toString() ? `?${params.toString()}` : ""}`;
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
              active === key ? "bg-ink text-white" : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
            )}
          >
            <Icon size={14} /> {t(labelKey)}
          </Link>
        );
      })}
    </div>
  );
}
