"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createMovementAction } from "@/app/actions/inventory-module";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { MOVEMENT_TYPES, MOVEMENT_DIRECTION, type MovementType } from "@/lib/inventory-constants";
import { useI18n } from "@/lib/i18n/locale-provider";

type Line = { productId: string; qty: string; fromWarehouseId: string; toWarehouseId: string };

// §24/§25 — a movement may be saved as a Draft before it balances out
// warehouses; only posting applies it to stock (see MovementActions).
//
// `allowedTypes` narrows the type picker (or fixes it to one type when it has
// a single entry) — used by the Receiving/Goods Issues/Transfers/Returns
// leaf pages so each only ever creates its own kind of movement.
// `showRecipient`/`showProject` add the PRD_Inventory_Dashboard Tagged
// Goods Issue / Transfer Receipt fields; posting the resulting movement is
// what actually puts it into PENDING confirmation (see inventory-module.ts).
export function MovementForm({
  products,
  warehouses,
  allowedTypes,
  showRecipient,
  showProject,
  recipients,
  projects,
  redirectTo,
}: {
  products: { id: string; sku: string; name: string }[];
  warehouses: { id: string; code: string; name: string }[];
  allowedTypes?: MovementType[];
  showRecipient?: boolean;
  showProject?: boolean;
  recipients?: { id: string; displayName: string }[];
  projects?: { id: string; name: string }[];
  redirectTo?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const types = allowedTypes && allowedTypes.length > 0 ? allowedTypes : MOVEMENT_TYPES;
  const [type, setType] = useState<MovementType>(types[0]!);
  const [reason, setReason] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", qty: "", fromWarehouseId: "", toWarehouseId: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const direction = MOVEMENT_DIRECTION[type];

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createMovementAction(undefined, {
        type,
        reason: reason || undefined,
        recipientId: showRecipient && recipientId ? recipientId : undefined,
        projectId: showProject && projectId ? projectId : undefined,
        lines: lines
          .filter((l) => l.productId && l.qty)
          .map((l) => ({
            productId: l.productId,
            qty: parseFloat(l.qty),
            fromWarehouseId: direction.requiresFrom ? l.fromWarehouseId : undefined,
            toWarehouseId: direction.requiresTo ? l.toWarehouseId : undefined,
          })),
      });
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      router.push(redirectTo ?? "/dashboard/inventory/movements");
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {types.length > 1 && (
          <div className="space-y-1.5">
            <Label htmlFor="mv-type">{t("inventoryModule.movementType")}</Label>
            <select
              id="mv-type"
              value={type}
              onChange={(e) => setType(e.target.value as MovementType)}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              {types.map((mt) => (
                <option key={mt} value={mt}>
                  {t(`inventoryModule.movementType_${mt}`)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="mv-reason">{t("inventoryModule.reason")}</Label>
          <Input id="mv-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {showRecipient && (
          <div className="space-y-1.5">
            <Label htmlFor="mv-recipient">{t("inventoryModule.recipient")}</Label>
            <select
              id="mv-recipient"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              <option value="">{t("common.none")}</option>
              {(recipients ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.displayName}</option>
              ))}
            </select>
          </div>
        )}
        {showProject && (
          <div className="space-y-1.5">
            <Label htmlFor="mv-project">{t("nav.projects")}</Label>
            <select
              id="mv-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              <option value="">{t("common.none")}</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={line.productId}
              onChange={(e) => updateLine(i, { productId: e.target.value })}
              className="h-9 flex-1 rounded-lg border border-border bg-surface px-2 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              <option value="">{t("inventoryModule.selectProduct")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
            {direction.requiresFrom && (
              <select
                value={line.fromWarehouseId}
                onChange={(e) => updateLine(i, { fromWarehouseId: e.target.value })}
                className="h-9 w-40 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold"
              >
                <option value="">{t("inventoryModule.fromWarehouse")}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code}
                  </option>
                ))}
              </select>
            )}
            {direction.requiresTo && (
              <select
                value={line.toWarehouseId}
                onChange={(e) => updateLine(i, { toWarehouseId: e.target.value })}
                className="h-9 w-40 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold"
              >
                <option value="">{t("inventoryModule.toWarehouse")}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code}
                  </option>
                ))}
              </select>
            )}
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder={t("inventoryModule.qty")}
              value={line.qty}
              onChange={(e) => updateLine(i, { qty: e.target.value })}
              className="w-24"
            />
            <button
              type="button"
              onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
              disabled={lines.length <= 1}
              className="shrink-0 text-ink-faint hover:text-danger disabled:opacity-30"
              aria-label={t("common.remove")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setLines((prev) => [...prev, { productId: "", qty: "", fromWarehouseId: "", toWarehouseId: "" }])}
        >
          <Plus size={13} /> {t("inventoryModule.addLine")}
        </Button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="button" disabled={isPending} onClick={submit}>
        {isPending ? t("common.creating") : t("common.create")}
      </Button>
    </div>
  );
}
