"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { removeProjectMemberAction } from "@/app/actions/project-members";
import { useI18n } from "@/lib/i18n/locale-provider";

export function RemoveMemberButton({ projectId, userId }: { projectId: string; userId: string }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      title={t("team.removeMember")}
      aria-label={t("team.removeMember")}
      onClick={() => startTransition(() => removeProjectMemberAction(projectId, userId))}
      className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint hover:bg-danger-soft hover:text-danger disabled:opacity-50"
    >
      <X size={13} />
    </button>
  );
}
