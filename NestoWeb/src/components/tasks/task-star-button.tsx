"use client";

import { toggleTaskStarAction } from "@/app/actions/tasks-module";
import { StarToggleButton } from "@/components/ui/star-toggle-button";
import { useI18n } from "@/lib/i18n/locale-provider";

// §14 Personal Star — private, never touches official priority/status, never
// notifies anyone else.
export function TaskStarButton({ taskId, starred, size = 15 }: { taskId: string; starred: boolean; size?: number }) {
  const { t } = useI18n();
  return (
    <StarToggleButton
      starred={starred}
      size={size}
      starLabel={t("task.star")}
      unstarLabel={t("task.unstar")}
      onToggle={() => toggleTaskStarAction(taskId)}
    />
  );
}
