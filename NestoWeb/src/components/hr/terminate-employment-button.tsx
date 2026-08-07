"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { terminateEmploymentAction } from "@/app/actions/hr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

export function TerminateEmploymentButton({ employmentId }: { employmentId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{t("hrDashboard.terminate")}</Button>;
  }

  return (
    <div className="flex items-center gap-2">
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-36" />
      <Button
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await terminateEmploymentAction(employmentId, date);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not terminate.");
            }
          })
        }
      >
        {t("common.confirm")}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
