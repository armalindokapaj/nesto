"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceNcrStageAction, reopenNcrAction } from "@/app/actions/qaqc-quality";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";
import { toActionError } from "@/lib/errors";

const STAGE_ORDER = ["DRAFT", "ISSUED", "CONTAINMENT", "ROOT_CAUSE", "CORRECTIVE_PLAN", "IMPLEMENTATION", "VERIFICATION", "CLOSED"] as const;

// §11.1 canonical lifecycle — one governed stage at a time, never skipped.
export function NcrStageActions({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currentIndex = STAGE_ORDER.indexOf(status as (typeof STAGE_ORDER)[number]);
  const nextStage = STAGE_ORDER[currentIndex + 1];

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

  if (status === "CLOSED" || status === "REOPENED") {
    return (
      <div className="flex flex-col items-end gap-1">
        {status === "CLOSED" && (
          <div className="flex items-center gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("qaqcModule.reopenReason")} className="w-40" />
            <Button size="sm" variant="secondary" disabled={isPending || !note.trim()} onClick={() => run(() => reopenNcrAction(id, note))}>{t("qaqcModule.reopen")}</Button>
          </div>
        )}
        {status === "REOPENED" && <Button size="sm" disabled={isPending} onClick={() => run(() => advanceNcrStageAction(id, "CONTAINMENT"))}>{t(`qaqcModule.ncrStage_CONTAINMENT`)}</Button>}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {nextStage && (
        <div className="flex items-center gap-2">
          {["CONTAINMENT", "ROOT_CAUSE", "CORRECTIVE_PLAN"].includes(nextStage) && (
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("qaqcModule.stageNote")} className="w-40" />
          )}
          <Button size="sm" disabled={isPending} onClick={() => run(() => advanceNcrStageAction(id, nextStage, note || undefined))}>
            {t(`qaqcModule.ncrStage_${nextStage}`)}
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
