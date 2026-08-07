"use client";

import { useState, useTransition } from "react";
import { confirmMovementReceiptAction, disputeMovementReceiptAction } from "@/app/actions/inventory-module";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

// PRD_Inventory_Dashboard — the named recipient's own confirm/dispute act on
// a PENDING (or DISPUTED, re-confirmable) movement. Server-side rejects
// anyone but the named recipient; this UI is shown to everyone but will
// surface that rejection as an error if clicked by the wrong person.
export function MovementConfirmActions({ movementId, confirmationStatus }: { movementId: string; confirmationStatus: string }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (confirmationStatus !== "PENDING" && confirmationStatus !== "DISPUTED") return null;

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        await confirmMovementReceiptAction(movementId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not confirm.");
      }
    });
  }

  function dispute() {
    setError(null);
    startTransition(async () => {
      try {
        await disputeMovementReceiptAction(movementId, reason);
        setDisputing(false);
        setReason("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not dispute.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {disputing ? (
        <div className="flex items-center gap-2">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("inventoryModule.disputeReason")} className="w-48" />
          <Button size="sm" variant="secondary" disabled={isPending || !reason.trim()} onClick={dispute}>{t("common.submit")}</Button>
          <Button size="sm" variant="ghost" onClick={() => setDisputing(false)}>{t("common.cancel")}</Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={isPending} onClick={confirm}>{t("inventoryModule.confirmReceipt")}</Button>
          {confirmationStatus === "PENDING" && (
            <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setDisputing(true)}>{t("inventoryModule.dispute")}</Button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
