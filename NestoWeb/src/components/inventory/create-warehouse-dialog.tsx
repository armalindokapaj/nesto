"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createWarehouseAction } from "@/app/actions/inventory-module";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateWarehouseDialog({ members }: { members: { id: string; displayName: string }[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createWarehouseAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("inventoryModule.newWarehouse")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t("inventoryModule.newWarehouse")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <form action={async (formData) => { await formAction(formData); setOpen(false); }} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wh-code">{t("inventoryModule.code")}</Label>
              <Input id="wh-code" name="code" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wh-name">{t("common.name")}</Label>
              <Input id="wh-name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wh-address">{t("inventoryModule.address")}</Label>
              <Input id="wh-address" name="address" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wh-manager">{t("inventoryModule.manager")}</Label>
              <select
                id="wh-manager"
                name="managerId"
                defaultValue=""
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                <option value="">{t("common.none")}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
            {state && "error" in state && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>
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
