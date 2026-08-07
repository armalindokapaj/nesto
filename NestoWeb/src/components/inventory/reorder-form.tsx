"use client";

import { useActionState } from "react";
import { setReorderLevelsAction } from "@/app/actions/inventory-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ReorderForm({ productId, warehouseId, reorderPoint, reorderQty }: { productId: string; warehouseId: string; reorderPoint?: number | null; reorderQty?: number | null }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(setReorderLevelsAction, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="warehouseId" value={warehouseId} />
      <Input name="reorderPoint" type="number" min="0" step="0.01" defaultValue={reorderPoint ?? ""} placeholder={t("inventoryModule.reorderPoint")} className="w-28" />
      <Input name="reorderQty" type="number" min="0" step="0.01" defaultValue={reorderQty ?? ""} placeholder={t("inventoryModule.reorderQty")} className="w-28" />
      <Button size="sm" type="submit" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</Button>
      {state && "error" in state && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
