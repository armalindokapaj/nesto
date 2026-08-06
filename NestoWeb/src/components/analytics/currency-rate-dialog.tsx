"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { setCurrencyRateAction } from "@/app/actions/analytics";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateCurrencyRateDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(setCurrencyRateAction, undefined);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm"><Plus size={14} /> {t("analytics.newRate")}</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("analytics.newRate")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
          </div>
          <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label htmlFor="fromCurrency">{t("analytics.fromCurrency")}</Label><Input id="fromCurrency" name="fromCurrency" placeholder="EUR" required /></div>
              <div className="space-y-1.5"><Label htmlFor="toCurrency">{t("analytics.toCurrency")}</Label><Input id="toCurrency" name="toCurrency" placeholder="ALL" required /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="rate">{t("analytics.rate")}</Label><Input id="rate" name="rate" type="number" step="0.0001" required /></div>
            {state?.error && <p className="text-sm text-danger">{state.error}</p>}
            <Button type="submit" className="w-full">{t("common.save")}</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
