"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { requestDocumentApprovalAction, decideDocumentApprovalAction } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";
import { toActionError } from "@/lib/errors";

// PRD_18 §13 — a tag/comment is not an approval; this is the formal request,
// converted into an Approval Request only after the server has confirmed the
// selected person actually has approval authority (src/server/documents.ts
// requestDocumentApproval).
export function RequestApprovalForm({ documentId, approvers }: { documentId: string; approvers: { id: string; displayName: string }[] }) {
  const { t } = useI18n();
  const [approverId, setApproverId] = useState(approvers[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (approvers.length === 0) {
    return <p className="text-xs text-ink-faint">{t("documents.noEligibleApprovers")}</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={approverId}
        onChange={(e) => setApproverId(e.target.value)}
        aria-label={t("documents.selectApprover")}
        className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      >
        {approvers.map((a) => (
          <option key={a.id} value={a.id}>
            {a.displayName}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await requestDocumentApprovalAction(documentId, approverId);
            } catch (err) {
              setError(toActionError(err, "Could not request approval."));
            }
          })
        }
      >
        {t("documents.requestApproval")}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

// PRD_18 §13 — the decision itself: Approve, Request Changes or Reject, with
// a mandatory comment for the latter two. Each decision is one more
// append-only DocumentApproval row (see decideDocumentApproval); approving
// is what makes the Blue Ticket appear.
export function ApprovalDecisionButtons({ documentId }: { documentId: string }) {
  const { t } = useI18n();
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT") {
    if (decision !== "APPROVE" && !comment.trim()) {
      setError(t("documents.commentRequired"));
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await decideDocumentApprovalAction(documentId, decision, comment.trim() || undefined);
      } catch (err) {
        setError(toActionError(err, "Could not record decision."));
      }
    });
  }

  return (
    <div className="space-y-2">
      <Textarea placeholder={t("documents.comment")} value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
      <div className="flex items-center gap-1.5">
        <Button size="sm" disabled={pending} onClick={() => decide("APPROVE")}>
          <Check size={13} /> {t("documents.approve")}
        </Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => decide("REQUEST_CHANGES")}>
          <RotateCcw size={13} /> {t("documents.requestChanges")}
        </Button>
        <Button size="sm" variant="danger" disabled={pending} onClick={() => decide("REJECT")}>
          <X size={13} /> {t("documents.reject")}
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
