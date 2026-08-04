"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createWorkPackageAction } from "@/app/actions/project-work-packages";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateWorkPackageDialog({ projectId, contractors }: { projectId: string; contractors: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createWorkPackageAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("workPackages.newWork")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("workPackages.newWork")}</Dialog.Title>
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
              <Label htmlFor="wpName">{t("workPackages.name")}</Label>
              <Input id="wpName" name="name" placeholder={t("workPackages.namePlaceholder")} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wpArea">{t("workPackages.area")}</Label>
                <Input id="wpArea" name="area" placeholder="Building A · Floor 3" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wpContractor">{t("projects.contractorsTitle")}</Label>
                <select
                  id="wpContractor"
                  name="contractorId"
                  defaultValue=""
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  <option value="">{t("common.none")}</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wpStart">{t("workPackages.startDate")}</Label>
                <Input id="wpStart" name="startDate" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wpFinish">{t("workPackages.expectedFinish")}</Label>
                <Input id="wpFinish" name="expectedFinishDate" type="date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wpUpdate">{t("workPackages.latestUpdate")}</Label>
              <Input id="wpUpdate" name="latestUpdate" placeholder={t("workPackages.latestUpdatePlaceholder")} />
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
