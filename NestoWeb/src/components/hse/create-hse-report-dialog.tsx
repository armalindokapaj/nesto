"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createHseReportAction } from "@/app/actions/hse";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateHseReportDialog({ projects }: { projects: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createHseReportAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("hse.newReport")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("hse.newReport")}</Dialog.Title>
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
            <div className="space-y-1.5">
              <Label htmlFor="projectId">{t("common.project")}</Label>
              <select
                id="projectId"
                name="projectId"
                required
                defaultValue=""
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                <option value="" disabled>
                  {t("common.project")}
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">{t("task.title")}</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="severity">{t("hse.severity")}</Label>
              <select
                id="severity"
                name="severity"
                defaultValue="MEDIUM"
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                <option value="LOW">{t("task.low")}</option>
                <option value="MEDIUM">{t("task.medium")}</option>
                <option value="HIGH">{t("task.high")}</option>
                <option value="CRITICAL">{t("task.critical")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">{t("hse.description")}</Label>
              <Textarea id="description" name="description" rows={3} placeholder={t("hse.descriptionPlaceholder")} required />
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
