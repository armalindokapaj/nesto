"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createBudgetAction } from "@/app/actions/finance-budget";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateBudgetDialog({ companyId, projects, defaultOpen }: { companyId: string; projects: { id: string; name: string }[]; defaultOpen?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [state, formAction, pending] = useActionState(createBudgetAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("dashboards.finance.newBudget")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t("dashboards.finance.newBudget")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <form
            action={async (formData) => {
              await formAction(formData);
              setOpen(false);
            }}
            className="space-y-3"
          >
            <input type="hidden" name="companyId" value={companyId} />
            <div className="space-y-1.5">
              <Label htmlFor="bg-project">{t("nav.projects")}</Label>
              <select
                id="bg-project"
                name="projectId"
                defaultValue=""
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                <option value="">{t("dashboards.finance.scopeCompany")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bg-period">{t("dashboards.finance.period")}</Label>
              <Input id="bg-period" name="period" placeholder="2026 or 2026-Q3" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="bg-amount">{t("dashboards.finance.baselineAmount")}</Label>
                <Input id="bg-amount" name="baselineAmount" type="number" min="0.01" step="0.01" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bg-currency">{t("common.currency")}</Label>
                <Input id="bg-currency" name="currency" defaultValue="EUR" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bg-cost-center">{t("dashboards.finance.costCenter")}</Label>
              <Input id="bg-cost-center" name="costCenter" />
            </div>
            {state && "error" in state && (
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
