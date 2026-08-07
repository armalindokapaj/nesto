"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyTimesheetAction, rejectTimesheetAction } from "@/app/actions/hr-timesheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function TimesheetVerifyActions({ id }: { id: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not complete this action.");
      }
    });
  }

  if (rejecting) {
    return (
      <div className="flex items-center gap-2">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("hrDashboard.rejectionReason")} className="w-40" />
        <Button size="sm" variant="secondary" disabled={isPending || !reason.trim()} onClick={() => run(() => rejectTimesheetAction(id, reason))}>{t("common.submit")}</Button>
        <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>{t("common.cancel")}</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={isPending} onClick={() => run(() => verifyTimesheetAction(id))}>{t("hrDashboard.verify")}</Button>
        <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setRejecting(true)}>{t("common.reject")}</Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
