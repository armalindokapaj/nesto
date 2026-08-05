"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createAccountAction } from "@/app/actions/finance-module";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ACCOUNT_TYPES } from "@/lib/finance-constants";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateAccountDialog({ accounts }: { accounts: { id: string; code: string; name: string }[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAccountAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("financeModule.newAccount")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t("financeModule.newAccount")}</Dialog.Title>
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
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="account-code">{t("financeModule.accountCode")}</Label>
                <Input id="account-code" name="code" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-type">{t("financeModule.accountType")}</Label>
                <select
                  id="account-type"
                  name="type"
                  required
                  defaultValue="ASSET"
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  {ACCOUNT_TYPES.map((t2) => (
                    <option key={t2} value={t2}>
                      {t2}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-name">{t("common.name")}</Label>
              <Input id="account-name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-parent">{t("financeModule.parentAccount")}</Label>
              <select
                id="account-parent"
                name="parentId"
                defaultValue=""
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                <option value="">{t("common.none")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" name="costCenterRequired" className="rounded border-border" />
              {t("financeModule.costCenterRequired")}
            </label>
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
