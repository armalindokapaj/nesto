"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startCountAction, recordCountLineAction, submitCountAction, approveCountAction, cancelCountAction } from "@/app/actions/inventory-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";
import { toActionError } from "@/lib/errors";

type CountLine = { id: string; productSku: string; productName: string; systemQty: number; countedQty: number | null };

export function CountDetailActions({ countId, status, lines, canApprove }: { countId: string; status: string; lines: CountLine[]; canApprove: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(toActionError(err, "Could not complete this action."));
      }
    });
  }

  return (
    <div className="space-y-4">
      {status === "IN_PROGRESS" && (
        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
              <div className="text-sm text-ink">{line.productSku} — {line.productName}</div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  className="w-24"
                  placeholder={t("inventoryModule.countedQty")}
                  defaultValue={line.countedQty ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [line.id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isPending || !values[line.id]}
                  onClick={() => run(() => recordCountLineAction(line.id, parseFloat(values[line.id] ?? "0")))}
                >
                  {t("common.save")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        {status === "PLANNED" && (
          <Button size="sm" disabled={isPending} onClick={() => run(() => startCountAction(countId))}>{t("inventoryModule.startCount")}</Button>
        )}
        {status === "IN_PROGRESS" && (
          <Button size="sm" disabled={isPending} onClick={() => run(() => submitCountAction(countId))}>{t("inventoryModule.submitCount")}</Button>
        )}
        {status === "SUBMITTED" && canApprove && (
          <Button size="sm" disabled={isPending} onClick={() => run(() => approveCountAction(countId))}>{t("inventoryModule.approveCount")}</Button>
        )}
        {status !== "APPROVED" && status !== "CANCELLED" && (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run(() => cancelCountAction(countId))}>{t("common.cancel")}</Button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
