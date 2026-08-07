"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { createCountAction } from "@/app/actions/inventory-dashboard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function CreateCountDialog({
  warehouses,
  products,
}: {
  warehouses: { id: string; code: string; name: string }[];
  products: { id: string; sku: string; name: string }[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [type, setType] = useState<"CYCLE" | "PHYSICAL">("CYCLE");
  const [blind, setBlind] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createCountAction(undefined, { warehouseId, type, blind, productIds: Array.from(selected) });
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm"><Plus size={14} /> {t("inventoryModule.newCount")}</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">{t("inventoryModule.newCount")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("inventoryModule.warehouse")}</Label>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink">
                  <option value="">{t("common.select")}</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("inventoryModule.countType")}</Label>
                <select value={type} onChange={(e) => setType(e.target.value as "CYCLE" | "PHYSICAL")} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink">
                  <option value="CYCLE">{t("inventoryModule.countTypeCycle")}</option>
                  <option value="PHYSICAL">{t("inventoryModule.countTypePhysical")}</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} /> {t("inventoryModule.blindCount")}
            </label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  {p.sku} — {p.name}
                </label>
              ))}
              {products.length === 0 && <p className="text-xs text-ink-faint">{t("inventoryModule.noProducts")}</p>}
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <Button type="button" disabled={isPending || !warehouseId || selected.size === 0} onClick={submit} className="w-full">
              {isPending ? t("common.creating") : t("common.create")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
