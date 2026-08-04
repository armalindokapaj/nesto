"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { replaceUnitAreaComponentsAction, updateUnitFinalPriceAction } from "@/app/actions/unit-area-components";
import { finalPrice, componentSubtotal, type AreaComponentInput } from "@/lib/unit-pricing";
import { UNIT_AREA_COMPONENT_TYPES, UNIT_AREA_COMPONENT_LABEL_KEY } from "@/lib/constants";
import type { UnitAreaComponentType } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

type Row = AreaComponentInput & { key: string };

let rowSeq = 0;
function newRow(partial: Partial<Row> = {}): Row {
  rowSeq += 1;
  return {
    key: `new-${rowSeq}`,
    componentType: "CUSTOM",
    label: "",
    areaM2: 0,
    pricePerM2: 0,
    isMain: false,
    includedInTotal: true,
    order: rowSeq,
    ...partial,
  };
}

// PRD_Unit_Page §6 — component-based pricing engine, live-previewed client-
// side with the same pure functions the backend uses as final authority
// (UNIT-007: preview here, but the page reflects the saved server result
// after submit via revalidatePath).
export function AreaPricingEditor({
  projectId,
  unitId,
  currency,
  fixedAdjustment,
  initialComponents,
  canManage,
}: {
  projectId: string;
  unitId: string;
  currency: string;
  fixedAdjustment: number;
  initialComponents: AreaComponentInput[];
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>(() =>
    initialComponents.length > 0 ? initialComponents.map((c) => ({ ...c, key: c.id ?? `existing-${Math.random()}` })) : [newRow({ componentType: "INTERNAL", label: "Internal", isMain: true })]
  );
  const [totalInput, setTotalInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const preview = finalPrice(rows, fixedAdjustment);

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function setMain(key: string) {
    setRows((prev) => prev.map((r) => ({ ...r, isMain: r.key === key })));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function save() {
    setError(null);
    setSavedMessage(null);
    startTransition(async () => {
      const result = await replaceUnitAreaComponentsAction(projectId, unitId, rows);
      if (result?.error) setError(result.error);
      else setSavedMessage(t("units.pricingSaved"));
    });
  }

  function saveFinalTotal() {
    const value = Number(totalInput);
    if (Number.isNaN(value)) {
      setError(t("units.enterValidTotal"));
      return;
    }
    setError(null);
    setSavedMessage(null);
    startTransition(async () => {
      const result = await updateUnitFinalPriceAction(projectId, unitId, value);
      if (result?.error) setError(result.error);
      else {
        setSavedMessage(t("units.pricingSaved"));
        setTotalInput("");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("units.areaPricing")}</CardTitle>
          <CardDescription>{t("units.areaPricingSubtitle")}</CardDescription>
        </div>
        {canManage && (
          <Button variant="secondary" size="sm" onClick={() => setRows((prev) => [...prev, newRow()])}>
            <Plus size={13} /> {t("units.addComponent")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-border p-2.5">
              <div className="col-span-2 space-y-1">
                <Label className="text-[0.65rem]">{t("units.componentType")}</Label>
                <select
                  value={row.componentType}
                  disabled={!canManage}
                  onChange={(e) => updateRow(row.key, { componentType: e.target.value })}
                  className="h-8 w-full rounded-md border border-border bg-surface px-1.5 text-xs text-ink focus:outline-none focus:border-gold disabled:opacity-60"
                >
                  {UNIT_AREA_COMPONENT_TYPES.map((ct) => (
                    <option key={ct} value={ct}>
                      {t(UNIT_AREA_COMPONENT_LABEL_KEY[ct as UnitAreaComponentType])}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-[0.65rem]">{t("units.componentLabel")}</Label>
                <Input value={row.label} disabled={!canManage} onChange={(e) => updateRow(row.key, { label: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-[0.65rem]">{t("units.areaM2")}</Label>
                <Input
                  type="number"
                  value={row.areaM2}
                  disabled={!canManage}
                  onChange={(e) => updateRow(row.key, { areaM2: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-[0.65rem]">{t("units.pricePerM2")}</Label>
                <Input
                  type="number"
                  value={row.pricePerM2}
                  disabled={!canManage}
                  onChange={(e) => updateRow(row.key, { pricePerM2: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-[0.65rem]">{t("units.subtotal")}</Label>
                <p className="h-8 flex items-center text-xs font-medium text-ink">{formatCurrency(componentSubtotal(row), currency)}</p>
              </div>
              <div className="col-span-1 flex items-center gap-1 pb-1.5">
                <input type="radio" name="mainComponent" checked={row.isMain} disabled={!canManage} onChange={() => setMain(row.key)} title={t("units.mainComponent")} />
                <input
                  type="checkbox"
                  checked={row.includedInTotal}
                  disabled={!canManage || row.isMain}
                  onChange={(e) => updateRow(row.key, { includedInTotal: e.target.checked })}
                  title={t("units.includedInTotal")}
                />
              </div>
              {canManage && (
                <button type="button" onClick={() => removeRow(row.key)} className="col-span-1 flex h-8 items-center justify-center text-ink-faint hover:text-danger">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-medium text-ink-muted">{t("units.finalPrice")}</span>
          <span className="text-xl font-semibold text-ink">{formatCurrency(preview, currency)}</span>
        </div>

        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
        {savedMessage && <p className="text-xs text-success">{savedMessage}</p>}

        {canManage && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" disabled={pending} onClick={save}>
              {pending ? t("common.saving") : t("units.saveComponents")}
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Input
                type="number"
                placeholder={t("units.editFinalTotal")}
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                className="h-8 w-36 text-xs"
              />
              <Button variant="secondary" size="sm" disabled={pending || !totalInput} onClick={saveFinalTotal}>
                {t("units.applyTotal")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
