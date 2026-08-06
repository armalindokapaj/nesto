"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createReportDefinitionAction } from "@/app/actions/analytics";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

const KINDS = ["PROJECTS_STATUS", "FINANCE_BUDGET_VS_ACTUAL", "HR_HEADCOUNT", "PROCUREMENT_SPEND", "WORK_PROGRESS_STATUS", "HSE_SAFETY"] as const;

export function CreateReportDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createReportDefinitionAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm"><Plus size={14} /> {t("analytics.newReport")}</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t("analytics.newReport")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
          </div>
          <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
            <div className="space-y-1.5"><Label htmlFor="name">{t("common.name")}</Label><Input id="name" name="name" required /></div>
            <div className="space-y-1.5">
              <Label htmlFor="kind">{t("analytics.reportKind")}</Label>
              <select id="kind" name="kind" defaultValue="PROJECTS_STATUS" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm">
                {KINDS.map((k) => <option key={k} value={k}>{t(`analytics.kind_${k}`)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="description">{t("common.description")}</Label><Input id="description" name="description" /></div>
            {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
            <Button type="submit" disabled={pending} className="w-full">{pending ? t("common.saving") : t("common.create")}</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
