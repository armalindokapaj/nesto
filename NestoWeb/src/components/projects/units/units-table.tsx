"use client";

import Link from "next/link";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UNIT_TYPE_LABELS, UNIT_LIFECYCLE_LABEL_KEY } from "@/lib/constants";
import type { UnitType, UnitLifecycleStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

export type UnitRow = {
  id: string;
  code: string;
  type: string;
  displayName: string | null;
  lifecycleStatus: string;
  currency: string;
  structure: { id: string; name: string } | null;
  floor: { id: string; label: string } | null;
  areaComponents: { componentType: string; areaM2: number; pricePerM2: number; isMain: boolean; includedInTotal: boolean }[];
  finalPriceValue: number;
  totalAreaM2: number;
};

// PRD_Units §7 default table columns. Client/Buyer, Amount paid, Remaining,
// Next payment and Overdue are Pass 2 columns (no reservation/payment domain
// yet) — omitted here rather than shown permanently empty, added back once
// the sales workflow lands.
export function UnitsTable({
  projectId,
  units,
  selectable,
  selected,
  onToggleSelect,
  onToggleSelectAll,
}: {
  projectId: string;
  units: UnitRow[];
  selectable: boolean;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
}) {
  const { t } = useI18n();

  const internalComponent = (u: UnitRow) => u.areaComponents.find((c) => c.isMain) ?? u.areaComponents[0];

  return (
    <Table>
      <THead>
        <TRow>
          {selectable && (
            <TH className="w-8">
              <input
                type="checkbox"
                checked={units.length > 0 && units.every((u) => selected.has(u.id))}
                onChange={onToggleSelectAll}
                className="rounded border-border-strong accent-gold"
              />
            </TH>
          )}
          <TH>{t("units.code")}</TH>
          <TH>{t("units.type")}</TH>
          <TH>{t("units.structureFloor")}</TH>
          <TH>{t("units.internalArea")}</TH>
          <TH>{t("units.totalArea")}</TH>
          <TH>{t("common.status")}</TH>
          <TH>{t("units.mainPricePerM2")}</TH>
          <TH>{t("units.finalPrice")}</TH>
        </TRow>
      </THead>
      <TBody>
        {units.map((unit) => {
          const main = internalComponent(unit);
          return (
            <TRow key={unit.id}>
              {selectable && (
                <TD>
                  <input
                    type="checkbox"
                    checked={selected.has(unit.id)}
                    onChange={() => onToggleSelect(unit.id)}
                    className="rounded border-border-strong accent-gold"
                  />
                </TD>
              )}
              <TD>
                <Link href={`/projects/${projectId}/units/${unit.id}`} className="font-medium text-ink hover:text-gold hover:underline">
                  {unit.code}
                </Link>
                {unit.displayName && <p className="text-xs text-ink-muted">{unit.displayName}</p>}
              </TD>
              <TD className="text-ink-muted">{UNIT_TYPE_LABELS[unit.type as UnitType] ?? unit.type}</TD>
              <TD className="text-ink-muted">{[unit.structure?.name, unit.floor?.label].filter(Boolean).join(" · ") || "—"}</TD>
              <TD className="text-ink-muted">{main ? `${main.areaM2} m²` : "—"}</TD>
              <TD className="text-ink-muted">{unit.totalAreaM2} m²</TD>
              <TD>
                <Badge status={unit.lifecycleStatus}>{t(UNIT_LIFECYCLE_LABEL_KEY[unit.lifecycleStatus as UnitLifecycleStatus] ?? unit.lifecycleStatus)}</Badge>
              </TD>
              <TD className="text-ink-muted">{main ? formatCurrency(main.pricePerM2, unit.currency) : "—"}</TD>
              <TD className="font-medium text-ink">{formatCurrency(unit.finalPriceValue, unit.currency)}</TD>
            </TRow>
          );
        })}
        {units.length === 0 && (
          <TRow>
            <TD colSpan={selectable ? 9 : 8} className="text-center text-ink-faint py-10">
              {t("units.noUnits")}
            </TD>
          </TRow>
        )}
      </TBody>
    </Table>
  );
}
