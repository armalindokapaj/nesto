"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createDefectAction } from "@/app/actions/qaqc-quality";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateDefectDialog({ projects, type = "DEFECT", members }: { projects: { id: string; name: string }[]; type?: "DEFECT" | "SNAG" | "PUNCH"; members: { id: string; displayName: string }[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createDefectAction, undefined);
  const labelKey = type === "SNAG" ? "qaqcModule.newSnag" : type === "PUNCH" ? "qaqcModule.newPunchItem" : "qaqcModule.newDefect";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm"><Plus size={14} /> {t(labelKey)}</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t(labelKey)}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
          </div>
          <form action={async (formData) => { await formAction(formData); setOpen(false); }} className="space-y-3">
            <input type="hidden" name="type" value={type} />
            <div className="space-y-1.5">
              <Label htmlFor="def-project">{t("nav.projects")}</Label>
              <select id="def-project" name="projectId" required className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink">
                <option value="">{t("common.select")}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="def-description">{t("common.description")}</Label>
              <Input id="def-description" name="description" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="def-location">{t("qaqcModule.location")}</Label>
              <Input id="def-location" name="location" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="def-severity">{t("qaqcModule.severity")}</Label>
                <select id="def-severity" name="severity" defaultValue="MEDIUM" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink">
                  <option value="LOW">{t("qaqcModule.severity_LOW")}</option>
                  <option value="MEDIUM">{t("qaqcModule.severity_MEDIUM")}</option>
                  <option value="HIGH">{t("qaqcModule.severity_HIGH")}</option>
                  <option value="CRITICAL">{t("qaqcModule.severity_CRITICAL")}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="def-assignee">{t("qaqcModule.assignTo")}</Label>
                <select id="def-assignee" name="assignedToId" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink">
                  <option value="">{t("common.none")}</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                </select>
              </div>
            </div>
            {state && "error" in state && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
            <Button type="submit" disabled={pending} className="w-full">{pending ? t("common.creating") : t("common.create")}</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
