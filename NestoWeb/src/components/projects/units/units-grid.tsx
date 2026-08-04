"use client";

import { useState } from "react";
import { UnitsTable, type UnitRow } from "@/components/projects/units/units-table";
import { UnitsCardGrid } from "@/components/projects/units/units-card-grid";
import { BulkActionBar } from "@/components/projects/units/bulk-action-bar";
import { useI18n } from "@/lib/i18n/locale-provider";

type PricedUnitRow = UnitRow & { pinnedRender: { id: string } | null };

export function UnitsGrid({
  projectId,
  units,
  view,
  canManage,
}: {
  projectId: string;
  units: PricedUnitRow[];
  view: "table" | "card";
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === units.length ? new Set() : new Set(units.map((u) => u.id))));
  }

  return (
    <div className="space-y-4">
      {view === "table" ? (
        <UnitsTable
          projectId={projectId}
          units={units}
          selectable={canManage}
          selected={selected}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      ) : (
        <UnitsCardGrid projectId={projectId} units={units} t={t} selectable={canManage} selected={selected} onToggleSelect={toggleSelect} />
      )}
      {canManage && <BulkActionBar projectId={projectId} selectedIds={Array.from(selected)} onClear={() => setSelected(new Set())} />}
    </div>
  );
}
