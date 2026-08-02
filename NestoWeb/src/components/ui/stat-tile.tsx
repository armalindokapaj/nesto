import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// A "Cue" per PRD_2 §3.4: a KPI tile that is also a click-through filter
// entry point. `href` is optional — tiles without a natural drill-down
// destination (e.g. a raw revenue total) render as plain, non-interactive
// cards exactly as before.
export function StatTile({
  label,
  value,
  icon: Icon,
  iconColor = "#2457C5",
  iconBg = "#E4ECFB",
  trend,
  trendTone = "success",
  helper,
  href,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: string;
  trendTone?: "success" | "danger" | "neutral";
  helper?: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon size={16} style={{ color: iconColor }} />
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-ink">{value}</span>
      </div>
      {(trend || helper) && (
        <span
          className={cn(
            "text-xs font-medium",
            trendTone === "success" && "text-success",
            trendTone === "danger" && "text-danger",
            trendTone === "neutral" && "text-ink-faint"
          )}
        >
          {trend ?? helper}
        </span>
      )}
    </>
  );

  const className = "rounded-xl border border-border bg-surface p-4 flex flex-col gap-3";

  if (href) {
    return (
      <Link href={href} className={cn(className, "transition-colors hover:border-border-strong hover:bg-surface-sunken/40")}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
