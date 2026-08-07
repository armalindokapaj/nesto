"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createInvestmentAction } from "@/app/actions/finance-other";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

const TYPES = ["EQUITY", "BOND", "DEPOSIT", "REAL_ESTATE", "OTHER"] as const;

export function CreateInvestmentDialog({ companyId, defaultOpen }: { companyId: string; defaultOpen?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [state, formAction, pending] = useActionState(createInvestmentAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("dashboards.finance.newInvestment")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t("dashboards.finance.newInvestment")}</Dialog.Title>
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
              <Label htmlFor="inv-name">{t("common.description")}</Label>
              <Input id="inv-name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-type">{t("dashboards.finance.investmentType")}</Label>
              <select
                id="inv-type"
                name="type"
                defaultValue="OTHER"
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                {TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {ty}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="inv-amount">{t("common.amount")}</Label>
                <Input id="inv-amount" name="amount" type="number" min="0.01" step="0.01" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-currency">{t("common.currency")}</Label>
                <Input id="inv-currency" name="currency" defaultValue="EUR" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-start">{t("common.date")}</Label>
              <Input id="inv-start" name="startDate" type="date" required />
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
