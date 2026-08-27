"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markDefectInCorrectionAction, submitDefectForReviewAction, verifyDefectAction, rejectDefectVerificationAction, closeDefectAction, reopenDefectAction } from "@/app/actions/qaqc-quality";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";
import { toActionError } from "@/lib/errors";

// §13.1 canonical lifecycle: Open -> Assigned -> In Correction -> Ready for
// Review -> Verified -> Closed, with reject-back-to-correction and reopen.
export function DefectActions({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
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
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {(status === "ASSIGNED" || status === "REOPENED") && <Button size="sm" disabled={isPending} onClick={() => run(() => markDefectInCorrectionAction(id))}>{t("qaqcModule.startCorrection")}</Button>}
        {status === "IN_CORRECTION" && <Button size="sm" disabled={isPending} onClick={() => run(() => submitDefectForReviewAction(id))}>{t("qaqcModule.submitForReview")}</Button>}
        {status === "READY_FOR_REVIEW" && !rejecting && (
          <>
            <Button size="sm" disabled={isPending} onClick={() => run(() => verifyDefectAction(id))}>{t("qaqcModule.verify")}</Button>
            <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setRejecting(true)}>{t("common.reject")}</Button>
          </>
        )}
        {status === "VERIFIED" && <Button size="sm" disabled={isPending} onClick={() => run(() => closeDefectAction(id))}>{t("common.close")}</Button>}
      </div>
      {status === "READY_FOR_REVIEW" && rejecting && (
        <div className="flex items-center gap-2">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("qaqcModule.rejectionReason")} className="w-40" />
          <Button size="sm" variant="secondary" disabled={isPending || !reason.trim()} onClick={() => run(() => rejectDefectVerificationAction(id, reason))}>{t("common.submit")}</Button>
        </div>
      )}
      {status === "CLOSED" && (
        <div className="flex items-center gap-2">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("qaqcModule.reopenReason")} className="w-40" />
          <Button size="sm" variant="secondary" disabled={isPending || !reason.trim()} onClick={() => run(() => reopenDefectAction(id, reason))}>{t("qaqcModule.reopen")}</Button>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
