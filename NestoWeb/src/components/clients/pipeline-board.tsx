"use client";

import { useTransition } from "react";
import Link from "next/link";
import { moveOpportunityStageAction, closeOpportunityAction } from "@/app/actions/crm-module";
import { useI18n } from "@/lib/i18n/locale-provider";

export type PipelineStageColumn = {
  id: string;
  name: string;
  probability: number;
  opportunities: {
    id: string;
    title: string;
    estimatedValue: number | null;
    client: { id: string; name: string };
    owner: { id: string; displayName: string } | null;
  }[];
};

// §21 — Phase-1 keeps this a select-to-move board rather than full
// drag-and-drop; a "Move to" picker on each card is equivalent to §21's
// "drag-and-drop status change" without the DnD library dependency.
export function PipelineBoard({ stages, canWrite }: { stages: PipelineStageColumn[]; canWrite: boolean }) {
  const { t } = useI18n();

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {stages.map((stage) => (
        <div key={stage.id} className="w-72 shrink-0 rounded-xl border border-border bg-surface-sunken/40">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <span className="text-sm font-semibold text-ink">{stage.name}</span>
            <span className="text-xs text-ink-faint">
              {stage.opportunities.length} · {stage.probability}%
            </span>
          </div>
          <div className="space-y-2 p-2.5">
            {stage.opportunities.map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} stages={stages} currentStageId={stage.id} canWrite={canWrite} />
            ))}
            {stage.opportunities.length === 0 && <p className="px-1 text-xs text-ink-faint">{t("crm.noOpportunities")}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function OpportunityCard({
  opp,
  stages,
  currentStageId,
  canWrite,
}: {
  opp: PipelineStageColumn["opportunities"][number];
  stages: PipelineStageColumn[];
  currentStageId: string;
  canWrite: boolean;
}) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-surface p-2.5 shadow-sm">
      <Link href={`/clients/${opp.client.id}`} className="block text-sm font-medium text-ink hover:text-gold hover:underline">
        {opp.title}
      </Link>
      <p className="text-xs text-ink-muted">{opp.client.name}</p>
      {opp.estimatedValue != null && <p className="text-xs text-ink-faint">€{opp.estimatedValue.toLocaleString()}</p>}
      {canWrite && (
        <div className="flex items-center gap-1 pt-1">
          <select
            defaultValue={currentStageId}
            disabled={isPending}
            onChange={(e) => startTransition(() => moveOpportunityStageAction(opp.id, e.target.value))}
            className="h-7 flex-1 rounded-md border border-border bg-surface px-1.5 text-[11px] text-ink focus:outline-none focus:border-gold"
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => closeOpportunityAction(opp.id, "WON"))}
            className="rounded-md border border-success/30 bg-success-soft px-1.5 py-1 text-[11px] font-medium text-success"
          >
            {t("crm.won")}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => closeOpportunityAction(opp.id, "LOST"))}
            className="rounded-md border border-danger/30 bg-danger-soft px-1.5 py-1 text-[11px] font-medium text-danger"
          >
            {t("crm.lost")}
          </button>
        </div>
      )}
    </div>
  );
}
