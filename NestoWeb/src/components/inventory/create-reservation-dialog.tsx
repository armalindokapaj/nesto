"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createReservationAction } from "@/app/actions/inventory-dashboard";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateReservationDialog({
  products,
  warehouses,
  projects,
}: {
  products: { id: string; sku: string; name: string }[];
  warehouses: { id: string; code: string; name: string }[];
  projects: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createReservationAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm"><Plus size={14} /> {t("inventoryModule.newReservation")}</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t("inventoryModule.newReservation")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
          </div>
          <form action={async (formData) => { await formAction(formData); setOpen(false); }} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-warehouse">{t("inventoryModule.warehouse")}</Label>
              <select id="res-warehouse" name="warehouseId" required className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink">
                <option value="">{t("common.select")}</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-product">{t("inventoryModule.product")}</Label>
              <select id="res-product" name="productId" required className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink">
                <option value="">{t("common.select")}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-qty">{t("inventoryModule.qty")}</Label>
              <Input id="res-qty" name="qty" type="number" min="0" step="0.01" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-project">{t("nav.projects")}</Label>
              <select id="res-project" name="projectId" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink">
                <option value="">{t("common.none")}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-purpose">{t("inventoryModule.purpose")}</Label>
              <Input id="res-purpose" name="purpose" />
            </div>
            {state && "error" in state && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>}
            <Button type="submit" disabled={pending} className="w-full">{pending ? t("common.creating") : t("common.create")}</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
