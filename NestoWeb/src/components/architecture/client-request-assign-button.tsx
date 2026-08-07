"use client";

import { useTransition } from "react";
import { assignClientRequestAction } from "@/app/actions/architecture";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ClientRequestAssignButton({ id, userId }: { id: string; userId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => assignClientRequestAction(id, userId))}
      className="text-xs text-gold hover:underline disabled:opacity-50"
    >
      {t("dashboards.architect.assignToMe")}
    </button>
  );
}
