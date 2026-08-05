"use client";

import { useActionState, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createProductAction } from "@/app/actions/inventory-module";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PRODUCT_TRACKING_TYPES } from "@/lib/inventory-constants";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateProductDialog({
  categories,
  units,
}: {
  categories: { id: string; name: string }[];
  units: { id: string; symbol: string }[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createProductAction, undefined);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Plus size={14} /> {t("inventoryModule.newProduct")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t("inventoryModule.newProduct")}</Dialog.Title>
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
                <Label htmlFor="product-sku">{t("inventoryModule.sku")}</Label>
                <Input id="product-sku" name="sku" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-tracking">{t("inventoryModule.trackingType")}</Label>
                <select
                  id="product-tracking"
                  name="trackingType"
                  defaultValue="NONE"
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  {PRODUCT_TRACKING_TYPES.map((tt) => (
                    <option key={tt} value={tt}>
                      {tt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-name">{t("common.name")}</Label>
              <Input id="product-name" name="name" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="product-category">{t("inventoryModule.category")}</Label>
                <select
                  id="product-category"
                  name="categoryId"
                  defaultValue=""
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  <option value="">{t("common.none")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-uom">{t("inventoryModule.baseUnit")}</Label>
                <select
                  id="product-uom"
                  name="baseUomId"
                  defaultValue=""
                  className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                >
                  <option value="">{t("common.none")}</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.symbol}
                    </option>
                  ))}
                </select>
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
