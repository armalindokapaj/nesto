"use client";

import { useTransition } from "react";
import { updatePurchaseOrderStatusAction } from "@/app/actions/procurement";
import { STATUS_TONE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

const STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "ORDERED", "RECEIVED", "CANCELLED"] as const;
const STATUS_KEY: Record<(typeof STATUSES)[number], string> = {
  DRAFT: "contracts.draft",
  SUBMITTED: "procurement_sub.statusSubmitted",
  APPROVED: "task.approved",
  ORDERED: "procurement_sub.statusOrdered",
  RECEIVED: "procurement_sub.statusReceived",
  CANCELLED: "procurement_sub.statusCancelled",
};

const TONE_TEXT: Record<string, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-ink-muted",
};

export function PurchaseOrderStatusSelect({ orderId, status }: { orderId: string; status: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const tone = STATUS_TONE[status] ?? "neutral";

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => startTransition(() => updatePurchaseOrderStatusAction(orderId, e.target.value))}
      className={cn(
        "h-7 rounded-md border border-border bg-surface pl-2 pr-6 text-xs font-medium focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-50",
        TONE_TEXT[tone]
      )}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(STATUS_KEY[s])}
        </option>
      ))}
    </select>
  );
}
