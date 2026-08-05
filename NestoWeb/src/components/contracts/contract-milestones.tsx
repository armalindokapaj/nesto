"use client";

import { useActionState, useTransition } from "react";
import { CircleDollarSign } from "lucide-react";
import { addMilestoneAction, updateMilestoneStatusAction } from "@/app/actions/contracts-module";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MILESTONE_STATUSES } from "@/lib/contract-constants";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

export type MilestoneRow = {
  id: string;
  title: string;
  plannedAt: Date | string | null;
  actualAt: Date | string | null;
  status: string;
  paymentTrigger: boolean;
};

// §21 — planned vs actual date, optional payment trigger flag (this
// contract's milestone releases a scheduled payment when it completes).
export function ContractMilestones({ contractId, milestones, canWrite }: { contractId: string; milestones: MilestoneRow[]; canWrite: boolean }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(addMilestoneAction, undefined);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {milestones.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                {m.title}
                {m.paymentTrigger && <CircleDollarSign size={13} className="shrink-0 text-gold" />}
              </p>
              <p className="truncate text-xs text-ink-faint">
                {m.plannedAt ? `${t("contractsModule.planned")} ${formatDate(m.plannedAt)}` : "—"}
                {m.actualAt ? ` · ${t("contractsModule.actual")} ${formatDate(m.actualAt)}` : ""}
              </p>
            </div>
            {canWrite && (
              <select
                defaultValue={m.status}
                disabled={isPending}
                onChange={(e) => startTransition(() => updateMilestoneStatusAction(m.id, contractId, e.target.value))}
                className="h-8 shrink-0 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                {MILESTONE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`contractsModule.milestoneStatus_${s}`)}
                  </option>
                ))}
              </select>
            )}
          </li>
        ))}
        {milestones.length === 0 && <p className="text-xs text-ink-faint">{t("contractsModule.noMilestones")}</p>}
      </ul>

      {canWrite && (
        <form action={formAction} className="flex items-center gap-2 border-t border-border pt-3">
          <input type="hidden" name="contractId" value={contractId} />
          <Input name="title" placeholder={t("contractsModule.milestoneTitle")} className="flex-1" />
          <Input name="plannedAt" type="date" className="w-40" />
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
            <input type="checkbox" name="paymentTrigger" className="rounded border-border" />
            {t("contractsModule.paymentTrigger")}
          </label>
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {t("common.create")}
          </Button>
          {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
