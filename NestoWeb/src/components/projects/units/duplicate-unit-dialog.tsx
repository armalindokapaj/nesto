"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, X } from "lucide-react";
import { duplicateUnitAction } from "@/app/actions/units";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

// PRD_Unit_Page §16 "Duplicate Unit / Unit Template" — copies physical
// fields, type-specific fields and area components; never copies buyer/
// reservation/payment/contract/handover state (none of that exists on Unit
// in Pass 1 anyway, so there's nothing to strip).
export function DuplicateUnitDialog({ projectId, unitId, sourceCode }: { projectId: string; unitId: string; sourceCode: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(duplicateUnitAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="sm">
          <Copy size={14} /> {t("units.duplicate")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("units.duplicateTitle")}</Dialog.Title>
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
            <input type="hidden" name="unitId" value={unitId} />
            <p className="text-xs text-ink-muted">{t("units.duplicateHint").replace("{code}", sourceCode)}</p>
            <div className="space-y-1.5">
              <Label htmlFor="dupCode">{t("units.newCode")}</Label>
              <Input id="dupCode" name="code" placeholder={`${sourceCode}-copy`} required />
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
