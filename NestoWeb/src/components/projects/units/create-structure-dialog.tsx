"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Building2, X } from "lucide-react";
import { createProjectStructureAction } from "@/app/actions/units";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

const STRUCTURE_KINDS = ["BUILDING", "BLOCK", "TOWER", "PHASE", "ZONE"] as const;

export function CreateStructureDialog({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createProjectStructureAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="sm">
          <Building2 size={14} /> {t("units.newStructure")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("units.newStructure")}</Dialog.Title>
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
            <div className="space-y-1.5">
              <Label htmlFor="sName">{t("units.structureName")}</Label>
              <Input id="sName" name="name" placeholder="Building A" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sKind">{t("units.structureKind")}</Label>
              <select
                id="sKind"
                name="kind"
                defaultValue="BUILDING"
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                {STRUCTURE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k.charAt(0) + k.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
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
