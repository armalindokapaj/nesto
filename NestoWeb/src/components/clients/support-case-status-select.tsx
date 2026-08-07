"use client";

import { useTransition } from "react";
import { updateSupportCaseStatusAction } from "@/app/actions/crm-module";
import { SUPPORT_CASE_STATUSES } from "@/lib/crm-constants";

export function SupportCaseStatusSelect({ caseId, status }: { caseId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) => startTransition(() => updateSupportCaseStatusAction(caseId, e.target.value))}
      className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
    >
      {SUPPORT_CASE_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
