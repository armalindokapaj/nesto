"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createUnitAction } from "@/app/actions/units";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { UNIT_TYPES, UNIT_TYPE_LABELS, UNIT_TYPE_FIELDS } from "@/lib/constants";
import type { UnitType } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/locale-provider";

type Structure = { id: string; name: string; floors: { id: string; label: string }[] };

export function CreateUnitDialog({ projectId, structures }: { projectId: string; structures: Structure[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<UnitType>("APARTMENT");
  const [structureId, setStructureId] = useState("");
  const [state, formAction, pending] = useActionState(createUnitAction, undefined);

  const selectedStructure = structures.find((s) => s.id === structureId);
  const typeFields = UNIT_TYPE_FIELDS[type] ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("units.newUnit")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("units.newUnit")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <form
            action={async (formData) => {
              await formAction(formData);
              setOpen(false);
            }}
            className="space-y-3.5"
          >
            <input type="hidden" name="projectId" value={projectId} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="uCode">{t("units.code")}</Label>
                <Input id="uCode" name="code" placeholder="A-101" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uType">{t("units.type")}</Label>
                <select
                  id="uType"
                  name="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as UnitType)}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
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
              <Label htmlFor="uDisplayName">{t("units.displayName")}</Label>
              <Input id="uDisplayName" name="displayName" />
            </div>
            {structures.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="uStructure">{t("units.structure")}</Label>
                  <select
                    id="uStructure"
                    name="structureId"
                    value={structureId}
                    onChange={(e) => setStructureId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
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
                    <Label htmlFor="uFloor">{t("units.floor")}</Label>
                    <select
                      id="uFloor"
                      name="floorId"
                      defaultValue=""
                      className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="uOrientation">{t("units.orientation")}</Label>
                <Input id="uOrientation" name="orientation" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uView">{t("units.view")}</Label>
                <Input id="uView" name="view" />
              </div>
            </div>
            {typeFields.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border bg-surface-sunken/50 p-3">
                <p className="text-xs font-medium text-ink-muted">{UNIT_TYPE_LABELS[type]} {t("units.typeFields")}</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {typeFields.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label htmlFor={`tf-${f.key}`} className="text-xs">
                        {f.label}
                      </Label>
                      {f.type === "select" ? (
                        <select
                          id={`tf-${f.key}`}
                          name={`typeField.${f.key}`}
                          defaultValue=""
                          className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-ink focus:outline-none focus:border-gold"
                        >
                          <option value=""></option>
                          {f.options?.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input id={`tf-${f.key}`} name={`typeField.${f.key}`} type={f.type === "number" ? "number" : "text"} className="h-9" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="uNotes">{t("common.notes")}</Label>
              <Input id="uNotes" name="notes" />
            </div>
            {state?.error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                {state.error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? t("common.creating") : t("common.create")}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
