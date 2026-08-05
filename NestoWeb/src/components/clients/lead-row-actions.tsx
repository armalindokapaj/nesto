"use client";

import { useTransition } from "react";
import { updateLeadStatusAction, convertLeadAction } from "@/app/actions/crm-module";
import { Button } from "@/components/ui/button";
import { LEAD_STATUSES } from "@/lib/crm-constants";
import { useI18n } from "@/lib/i18n/locale-provider";

// §17 — moving a lead to CONVERTED here is display-only bookkeeping; the
// actual conversion (creating the Client + Opportunity) only happens
// through the explicit Convert action below.
export function LeadRowActions({ leadId, status, canWrite }: { leadId: string; status: string; canWrite: boolean }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  if (!canWrite) return null;
  if (status === "CONVERTED") return <span className="text-xs text-ink-faint">{t("crm.converted")}</span>;

  return (
    <div className="flex items-center gap-1.5">
      <select
        defaultValue={status}
        disabled={isPending}
        onChange={(e) => startTransition(() => updateLeadStatusAction(leadId, e.target.value))}
        className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      >
        {LEAD_STATUSES.filter((s) => s !== "CONVERTED").map((s) => (
          <option key={s} value={s}>
            {t(`crm.leadStatus_${s}`)}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="secondary"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await convertLeadAction(leadId);
          })
        }
      >
        {t("crm.convert")}
      </Button>
    </div>
  );
}
