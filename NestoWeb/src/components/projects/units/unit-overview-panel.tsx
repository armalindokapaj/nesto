"use client";

import { useActionState, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { updateUnitAction } from "@/app/actions/units";
import { UNIT_TYPES, UNIT_TYPE_LABELS, UNIT_TYPE_FIELDS, UNIT_CONSTRUCTION_STATUSES, UNIT_CONSTRUCTION_STATUS_KEY } from "@/lib/constants";
import type { UnitType } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/locale-provider";

type Structure = { id: string; name: string; floors: { id: string; label: string }[] };

// PRD_Unit_Page §5 — universal fields + the type-specific dynamic-field
// renderer (schema in UNIT_TYPE_FIELDS). Always-editable form rather than a
// separate view/edit-dialog split — simpler, and version is carried as a
// hidden field so a stale save surfaces the optimistic-concurrency conflict
// from updateUnit() as a normal form error.
export function UnitOverviewPanel({
  projectId,
  unit,
  structures,
  canManage,
}: {
  projectId: string;
  unit: {
    id: string;
    code: string;
    type: string;
    displayName: string | null;
    structureId: string | null;
    floorId: string | null;
    orientation: string | null;
    view: string | null;
    features: string | null;
    notes: string | null;
    constructionStatus: string | null;
    typeFields: string | null;
    version: number;
  };
  structures: Structure[];
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [type, setType] = useState(unit.type as UnitType);
  const [structureId, setStructureId] = useState(unit.structureId ?? "");
  const [state, formAction, pending] = useActionState(updateUnitAction, undefined);

  const selectedStructure = structures.find((s) => s.id === structureId);
  const typeFields = UNIT_TYPE_FIELDS[type] ?? [];
  const savedTypeFields: Record<string, string> = unit.typeFields ? JSON.parse(unit.typeFields) : {};

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("units.overview")}</CardTitle>
          <CardDescription>{t("units.overviewSubtitle")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3.5">
          <input type="hidden" name="unitId" value={unit.id} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="version" value={unit.version} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ovCode">{t("units.code")}</Label>
              <Input id="ovCode" name="code" defaultValue={unit.code} required disabled={!canManage} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ovType">{t("units.type")}</Label>
              <select
                id="ovType"
                name="type"
                value={type}
                disabled={!canManage}
                onChange={(e) => setType(e.target.value as UnitType)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60"
              >
                {UNIT_TYPES.map((ut) => (
                  <option key={ut} value={ut}>
                    {UNIT_TYPE_LABELS[ut]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ovDisplayName">{t("units.displayName")}</Label>
            <Input id="ovDisplayName" name="displayName" defaultValue={unit.displayName ?? ""} disabled={!canManage} />
          </div>
          {structures.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ovStructure">{t("units.structure")}</Label>
                <select
                  id="ovStructure"
                  name="structureId"
                  value={structureId}
                  disabled={!canManage}
                  onChange={(e) => setStructureId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60"
                >
                  <option value="">{t("common.none")}</option>
                  {structures.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedStructure && selectedStructure.floors.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="ovFloor">{t("units.floor")}</Label>
                  <select
                    id="ovFloor"
                    name="floorId"
                    defaultValue={unit.floorId ?? ""}
                    disabled={!canManage}
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60"
                  >
                    <option value="">{t("common.none")}</option>
                    {selectedStructure.floors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ovOrientation">{t("units.orientation")}</Label>
              <Input id="ovOrientation" name="orientation" defaultValue={unit.orientation ?? ""} disabled={!canManage} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ovView">{t("units.view")}</Label>
              <Input id="ovView" name="view" defaultValue={unit.view ?? ""} disabled={!canManage} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ovConstruction">{t("units.constructionStatus")}</Label>
              <select
                id="ovConstruction"
                name="constructionStatus"
                defaultValue={unit.constructionStatus ?? ""}
                disabled={!canManage}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60"
              >
                <option value="">{t("common.none")}</option>
                {UNIT_CONSTRUCTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(UNIT_CONSTRUCTION_STATUS_KEY[s])}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ovFeatures">{t("units.features")}</Label>
            <Input id="ovFeatures" name="features" defaultValue={unit.features ?? ""} disabled={!canManage} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ovNotes">{t("common.notes")}</Label>
            <Input id="ovNotes" name="notes" defaultValue={unit.notes ?? ""} disabled={!canManage} />
          </div>

          {typeFields.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border bg-surface-sunken/50 p-3">
              <p className="text-xs font-medium text-ink-muted">
                {UNIT_TYPE_LABELS[type]} {t("units.typeFields")}
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {typeFields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label htmlFor={`ovtf-${f.key}`} className="text-xs">
                      {f.label}
                    </Label>
                    {f.type === "select" ? (
                      <select
                        id={`ovtf-${f.key}`}
                        name={`typeField.${f.key}`}
                        defaultValue={savedTypeFields[f.key] ?? ""}
                        disabled={!canManage}
                        className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-ink focus:outline-none focus:border-gold disabled:opacity-60"
                      >
                        <option value=""></option>
                        {f.options?.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={`ovtf-${f.key}`}
                        name={`typeField.${f.key}`}
                        type={f.type === "number" ? "number" : "text"}
                        defaultValue={savedTypeFields[f.key] ?? ""}
                        disabled={!canManage}
                        className="h-9"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {state?.error && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
              {state.error}
            </p>
          )}
          {canManage && (
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
