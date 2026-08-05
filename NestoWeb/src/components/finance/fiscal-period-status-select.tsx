"use client";

import { useTransition } from "react";
import { updateFiscalPeriodStatusAction } from "@/app/actions/finance-module";
import { FISCAL_PERIOD_STATUSES } from "@/lib/finance-constants";
import { useI18n } from "@/lib/i18n/locale-provider";

// §9 — closing a period is what makes posting into it rejected everywhere
// else in Finance (see postJournalEntry's period.status !== "OPEN" check).
export function FiscalPeriodStatusSelect({ periodId, status }: { periodId: string; status: string }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={isPending}
      onChange={(e) => startTransition(() => updateFiscalPeriodStatusAction(periodId, e.target.value))}
      className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
    >
      {FISCAL_PERIOD_STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(`financeModule.periodStatus_${s}`)}
        </option>
      ))}
    </select>
  );
}
