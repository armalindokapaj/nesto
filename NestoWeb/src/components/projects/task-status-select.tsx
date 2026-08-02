"use client";

import { useTransition } from "react";
import { updateTaskStatusAction } from "@/app/actions/projects";
import { TASK_STATUSES, TASK_STATUS_KEY } from "@/lib/constants";
import type { TaskStatus } from "@/lib/constants";
import { STATUS_TONE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

const TONE_TEXT: Record<string, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-ink-muted",
};

export function TaskStatusSelect({
  taskId,
  projectId,
  clientId,
  status,
}: {
  taskId: string;
  projectId?: string;
  clientId?: string;
  status: TaskStatus;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const tone = STATUS_TONE[status] ?? "neutral";

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => startTransition(() => updateTaskStatusAction(taskId, projectId, e.target.value, clientId))}
      className={cn(
        "h-7 rounded-md border border-border bg-surface pl-2 pr-6 text-xs font-medium focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-50",
        TONE_TEXT[tone]
      )}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(TASK_STATUS_KEY[s])}
        </option>
      ))}
    </select>
  );
}
