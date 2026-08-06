"use client";

// PRD_Documents_Module §27 — Required Reading assignment + acknowledgment.

import { useActionState, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { setRequiredReadingAction, acknowledgeRequiredReadingAction } from "@/app/actions/documents-module";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

type Receipt = { id: string; assignedAt: Date | string | null; acknowledgedAt: Date | string | null; user: { id: string; displayName: string; avatarColor: string } };

export function RequiredReadingCard({
  documentId,
  required,
  receipts,
  currentUserId,
  canAssign,
  members,
}: {
  documentId: string;
  required: boolean;
  receipts: Receipt[];
  currentUserId: string;
  canAssign: boolean;
  members: { id: string; displayName: string }[];
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(setRequiredReadingAction, undefined);
  const [ackPending, startAck] = useTransition();
  const [assigning, setAssigning] = useState(false);

  const myReceipt = receipts.find((r) => r.user.id === currentUserId);
  const acknowledgedCount = receipts.filter((r) => r.acknowledgedAt).length;

  return (
    <div className="space-y-3">
      {required ? (
        <>
          <p className="text-xs text-ink-muted">
            {t("documents.requiredReadingAssigned")} · {acknowledgedCount}/{receipts.length} {t("documents.acknowledged")}
          </p>
          {myReceipt && !myReceipt.acknowledgedAt && (
            <Button size="sm" disabled={ackPending} onClick={() => startAck(() => acknowledgeRequiredReadingAction(documentId))}>
              <CheckCircle2 size={14} /> {ackPending ? t("common.saving") : t("documents.markAsRead")}
            </Button>
          )}
          {myReceipt?.acknowledgedAt && (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 size={14} /> {t("documents.youAcknowledged")} {formatDate(myReceipt.acknowledgedAt)}
            </p>
          )}
          {receipts.length > 0 && (
            <ul className="space-y-1 border-t border-border pt-2 text-xs text-ink-muted">
              {receipts.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span>{r.user.displayName}</span>
                  <span className={r.acknowledgedAt ? "text-success" : "text-ink-faint"}>
                    {r.acknowledgedAt ? formatDate(r.acknowledgedAt) : t("documents.pending")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-xs text-ink-faint">{t("documents.notRequiredReading")}</p>
      )}
      {canAssign && (
        <>
          {!assigning ? (
            <Button size="sm" variant="secondary" onClick={() => setAssigning(true)}>
              {required ? t("documents.reassignReading") : t("documents.assignReading")}
            </Button>
          ) : (
            <form action={formAction} className="space-y-2 rounded-lg border border-border p-3">
              <input type="hidden" name="documentId" value={documentId} />
              <label className="flex items-center gap-2 text-xs text-ink">
                <input type="checkbox" name="required" defaultChecked={required} /> {t("documents.requireReading")}
              </label>
              <select multiple name="assigneeIds" className="h-24 w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs" defaultValue={receipts.map((r) => r.user.id)}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.displayName}</option>
                ))}
              </select>
              {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setAssigning(false)}>{t("common.cancel")}</Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
