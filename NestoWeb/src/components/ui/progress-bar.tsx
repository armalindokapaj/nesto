import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  max = 100,
  tone = "gold",
  className,
}: {
  value: number;
  max?: number;
  tone?: "gold" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const toneClass = {
    gold: "bg-gold",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
  }[tone];

  return (
    <div className={cn("h-1.5 w-full rounded-full bg-surface-sunken overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-[var(--motion-slow)] ease-[var(--motion-ease)]", toneClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
