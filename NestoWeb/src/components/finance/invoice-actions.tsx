"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { postInvoiceAction, reverseInvoiceAction } from "@/app/actions/finance";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function InvoiceActions({ invoiceId, status }: { invoiceId: string; status: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (status === "POSTED") {
    return (
      <Dialog.Root open={reverseOpen} onOpenChange={setReverseOpen}>
        <Dialog.Trigger asChild>
          <Button size="sm" variant="secondary">
            {t("finance_sub.reverse")}
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
            <Dialog.Title className="text-base font-semibold text-ink mb-3">{t("finance_sub.reverseTitle")}</Dialog.Title>
            <p className="text-xs text-ink-muted mb-3">{t("finance_sub.reverseDesc")}</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("finance_sub.reverseReasonPlaceholder")}
              className="w-full h-20 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
            <Button
              size="sm"
              variant="danger"
              disabled={pending || !reason.trim()}
              className="w-full mt-3"
              onClick={() =>
                startTransition(async () => {
                  await reverseInvoiceAction(invoiceId, reason);
                  setReverseOpen(false);
                  setReason("");
                })
              }
            >
              {t("finance_sub.confirmReversal")}
            </Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  if (status === "REVERSED") {
    return null;
  }

  return (
    <Button size="sm" disabled={pending} onClick={() => startTransition(() => postInvoiceAction(invoiceId))}>
      {t("finance_sub.post")}
    </Button>
  );
}
