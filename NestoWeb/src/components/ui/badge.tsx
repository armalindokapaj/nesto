import { cn } from "@/lib/utils";
import { STATUS_TONE } from "@/lib/constants";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-sunken text-ink-muted",
};

export function Badge({
  children,
  tone,
  status,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  status?: string;
  className?: string;
}) {
  const resolvedTone = tone ?? (status ? STATUS_TONE[status] ?? "neutral" : "neutral");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[resolvedTone],
        className
      )}
    >
      {children}
    </span>
  );
}
