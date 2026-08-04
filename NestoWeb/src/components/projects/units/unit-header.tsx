"use client";

import { useTransition } from "react";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UnitRenderGalleryDialog } from "@/components/projects/units/unit-render-gallery-dialog";
import { DuplicateUnitDialog } from "@/components/projects/units/duplicate-unit-dialog";
import { transitionUnitStatusAction } from "@/app/actions/units";
import { UNIT_TYPE_LABELS, UNIT_LIFECYCLE_STATUSES, UNIT_LIFECYCLE_LABEL_KEY, UNIT_MANUAL_TRANSITIONS } from "@/lib/constants";
import type { UnitType, UnitLifecycleStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

type Render = { id: string; uploadedBy: { displayName: string } };

// PRD_Unit_Page §4 — identity/hierarchy/status/current price/visual/primary
// actions. "Open in 3D" is absent (Pass 1 has no 3D infra, same as the
// Project Page's own Header) and Reserve/Sell/Contract are absent (Pass 2's
// sales workflow) — status can still move through every Pass-1-reachable
// transition here (UNIT-004: disabled with an explanation, not hidden).
export function UnitHeader({
  projectId,
  unit,
  finalPriceValue,
  renders,
  canManage,
}: {
  projectId: string;
  unit: {
    id: string;
    code: string;
    displayName: string | null;
    type: string;
    lifecycleStatus: string;
    currency: string;
    project: { name: string; code: string };
    structure: { name: string } | null;
    floor: { label: string } | null;
    pinnedRender: { id: string } | null;
  };
  finalPriceValue: number;
  renders: Render[];
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const allowedTransitions = UNIT_MANUAL_TRANSITIONS[unit.lifecycleStatus as UnitLifecycleStatus] ?? [];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-col sm:flex-row">
        <div className="flex-1 space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-ink">{unit.displayName || unit.code}</h1>
            <Badge tone="neutral">{UNIT_TYPE_LABELS[unit.type as UnitType] ?? unit.type}</Badge>
            <Badge status={unit.lifecycleStatus}>{t(UNIT_LIFECYCLE_LABEL_KEY[unit.lifecycleStatus as UnitLifecycleStatus] ?? unit.lifecycleStatus)}</Badge>
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
            <span>{unit.code}</span>
            <span className="text-ink-faint">·</span>
            <span>{unit.project.name}</span>
            {unit.structure && (
              <>
                <span className="text-ink-faint">·</span>
                <span>{unit.structure.name}</span>
              </>
            )}
            {unit.floor && (
              <>
                <span className="text-ink-faint">·</span>
                <span>{unit.floor.label}</span>
              </>
            )}
          </p>
          <p className="text-2xl font-semibold text-ink">{formatCurrency(finalPriceValue, unit.currency)}</p>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <select
                disabled={pending || allowedTransitions.length === 0}
                value=""
                onChange={(e) => {
                  if (e.target.value) startTransition(() => transitionUnitStatusAction(projectId, unit.id, e.target.value));
                }}
                title={allowedTransitions.length === 0 ? t("units.transitionNeedsSalesWorkflow") : undefined}
                className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-50"
              >
                <option value="" disabled>
                  {t("units.changeStatus")}
                </option>
                {UNIT_LIFECYCLE_STATUSES.filter((s) => allowedTransitions.includes(s)).map((s) => (
                  <option key={s} value={s}>
                    {t(UNIT_LIFECYCLE_LABEL_KEY[s])}
                  </option>
                ))}
              </select>
              <DuplicateUnitDialog projectId={projectId} unitId={unit.id} sourceCode={unit.code} />
            </div>
          )}
        </div>

        <UnitRenderGalleryDialog projectId={projectId} unitId={unit.id} renders={renders} pinnedRenderId={unit.pinnedRender?.id ?? null} canManage={canManage}>
          <button type="button" className="group relative h-48 w-full shrink-0 overflow-hidden bg-surface-sunken sm:h-auto sm:w-72">
            {unit.pinnedRender ? (
              // eslint-disable-next-line @next/next/no-img-element -- served from our own blob API route
              <img src={`/api/unit-renders/${unit.pinnedRender.id}/file`} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Building2 size={32} className="text-ink-faint" />
              </div>
            )}
            <span className="absolute inset-0 bg-ink/0 transition-colors group-hover:bg-ink/10" />
          </button>
        </UnitRenderGalleryDialog>
      </div>
    </div>
  );
}
