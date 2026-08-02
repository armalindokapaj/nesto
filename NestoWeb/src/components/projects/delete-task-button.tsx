"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteTaskAction } from "@/app/actions/projects";
import { useI18n } from "@/lib/i18n/locale-provider";

export function DeleteTaskButton({ taskId, projectId, clientId }: { taskId: string; projectId?: string; clientId?: string }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      title={t("task.deleteTask")}
      aria-label={t("task.deleteTask")}
      onClick={() => {
        if (window.confirm(t("task.confirmDelete"))) {
          startTransition(() => deleteTaskAction(taskId, projectId, clientId));
        }
      }}
      className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint hover:bg-danger-soft hover:text-danger disabled:opacity-50"
    >
      <Trash2 size={13} />
    </button>
  );
}
