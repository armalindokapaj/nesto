"use client";

import { useActionState, useState, useTransition } from "react";
import { submitSpendingBillAction, decideSpendingBillAction, markSpendingBillPaidAction } from "@/app/actions/finance-spendings";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function SpendingBillActions({ billId, status, canDecide }: { billId: string; status: string; canDecide: boolean }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [payState, payAction, payPending] = useActionState(markSpendingBillPaidAction, undefined);

  if (status === "DRAFT") {
    return (
      <Button size="sm" disabled={pending} onClick={() => startTransition(() => submitSpendingBillAction(billId))}>
        {t("dashboards.finance.submitForApproval")}
      </Button>
    );
  }

  if ((status === "PENDING_SUPERIOR" || status === "PENDING_FINANCE") && canDecide) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => startTransition(() => decideSpendingBillAction(billId, "APPROVE"))}>
            {t("common.approve")}
          </Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => setRejectOpen((v) => !v)}>
            {t("common.reject")}
          </Button>
        </div>
        {rejectOpen && (
          <div className="flex gap-2">
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("dashboards.finance.rejectionReason")} />
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => startTransition(() => decideSpendingBillAction(billId, "REJECT", comment))}>
              {t("common.reject")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (status === "APPROVED_FOR_PAYMENT") {
    return (
      <form action={payAction} className="flex items-end gap-2">
        <input type="hidden" name="spendingBillId" value={billId} />
        <div className="space-y-1.5">
          <Label htmlFor="transfer-ref">{t("dashboards.finance.transferReference")}</Label>
          <Input id="transfer-ref" name="transferReference" required />
        </div>
        <Button type="submit" size="sm" disabled={payPending}>
          {t("dashboards.finance.markPaid")}
        </Button>
        {payState && "error" in payState && <p className="text-xs text-danger">{payState.error}</p>}
      </form>
    );
  }

  return null;
}
