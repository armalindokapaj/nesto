"use client";

import { useActionState, useTransition } from "react";
import { addObligationAction, updateObligationStatusAction } from "@/app/actions/contracts-module";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OBLIGATION_STATUSES } from "@/lib/contract-constants";
import { cn, formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

export type ObligationRow = {
  id: string;
  title: string;
  dueAt: Date | string | null;
  status: string;
  priority: string;
  owner: { displayName: string } | null;
  party: { legalName: string } | null;
};

// §20 — every obligation is attributable to a party and auditable (each
// status change writes a ContractActivity event server-side).
export function ContractObligations({ contractId, obligations, canWrite }: { contractId: string; obligations: ObligationRow[]; canWrite: boolean }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(addObligationAction, undefined);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {obligations.map((o) => {
          // §20 overdue emphasis — driven by the explicit OVERDUE status
          // rather than a client-side "now" comparison (kept a pure render).
          const overdue = o.status === "OVERDUE";
          return (
            <li key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <div className="min-w-0">
                <p className={cn("truncate text-sm font-medium", overdue ? "text-danger" : "text-ink")}>{o.title}</p>
                <p className="truncate text-xs text-ink-faint">
                  {[o.party?.legalName, o.owner?.displayName, o.dueAt ? formatDate(o.dueAt) : null].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              {canWrite ? (
                <select
                  defaultValue={o.status}
                  disabled={isPending}
                  onChange={(e) => startTransition(() => updateObligationStatusAction(o.id, contractId, e.target.value))}
                  className="h-8 shrink-0 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  {OBLIGATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`contractsModule.obligationStatus_${s}`)}
                    </option>
                  ))}
                </select>
              ) : (
                <Badge tone={overdue ? "danger" : o.status === "COMPLETED" ? "success" : "neutral"}>
                  {t(`contractsModule.obligationStatus_${o.status}`)}
                </Badge>
              )}
            </li>
          );
        })}
        {obligations.length === 0 && <p className="text-xs text-ink-faint">{t("contractsModule.noObligations")}</p>}
      </ul>

      {canWrite && (
        <form action={formAction} className="flex items-center gap-2 border-t border-border pt-3">
          <input type="hidden" name="contractId" value={contractId} />
          <Input name="title" placeholder={t("contractsModule.obligationTitle")} className="flex-1" />
          <Input name="dueAt" type="date" className="w-40" />
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {t("common.create")}
          </Button>
          {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
