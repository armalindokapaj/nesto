"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createLoanAction } from "@/app/actions/finance-other";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateLoanDialog({ companyId, defaultOpen }: { companyId: string; defaultOpen?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [state, formAction, pending] = useActionState(createLoanAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("dashboards.finance.newLoan")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t("dashboards.finance.newLoan")}</Dialog.Title>
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
              <Label htmlFor="loan-lender">{t("dashboards.finance.lender")}</Label>
              <Input id="loan-lender" name="lender" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="loan-principal">{t("dashboards.finance.principal")}</Label>
                <Input id="loan-principal" name="principal" type="number" min="0.01" step="0.01" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loan-currency">{t("common.currency")}</Label>
                <Input id="loan-currency" name="currency" defaultValue="EUR" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="loan-outstanding">{t("dashboards.finance.outstanding")}</Label>
                <Input id="loan-outstanding" name="outstanding" type="number" min="0" step="0.01" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loan-rate">{t("dashboards.finance.interestRate")}</Label>
                <Input id="loan-rate" name="interestRate" type="number" min="0" step="0.01" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="loan-start">{t("common.date")}</Label>
                <Input id="loan-start" name="startDate" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loan-maturity">{t("dashboards.finance.maturityDate")}</Label>
                <Input id="loan-maturity" name="maturityDate" type="date" />
              </div>
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
