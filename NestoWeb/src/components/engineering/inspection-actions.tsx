"use client";

import { useActionState, useState, useTransition } from "react";
import { markInspectionReadyAction, startInspectionAction, issueInspectionResultAction, reopenForReinspectionAction } from "@/app/actions/qaqc";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

const RESULTS = ["PASS", "PASS_WITH_COMMENTS", "CONDITIONAL_ACCEPTANCE", "PARTIAL_PASS", "FAIL"] as const;

// §20.1 — status-driven action set. A FAIL result can only be followed by
// reopening for a fresh execute->result cycle, never a direct edit (server
// enforces this too; this UI just mirrors the same state machine).
export function InspectionActions({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [resultState, resultAction, resultPending] = useActionState(issueInspectionResultAction, undefined);
  const [showResult, setShowResult] = useState(false);

  if (status === "REQUESTED" || status === "SCHEDULED") {
    return (
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => startTransition(() => markInspectionReadyAction(id))}>
        {t("dashboards.engineer.markReady")}
      </Button>
    );
  }

  if (status === "READY") {
    return (
      <Button size="sm" disabled={pending} onClick={() => startTransition(() => startInspectionAction(id))}>
        {t("dashboards.engineer.start")}
      </Button>
    );
  }

  if (status === "IN_INSPECTION") {
    if (!showResult) {
      return (
        <Button size="sm" onClick={() => setShowResult(true)}>
          {t("dashboards.engineer.issueResult")}
        </Button>
      );
    }
    return (
      <form action={resultAction} className="flex items-center gap-1.5">
        <input type="hidden" name="id" value={id} />
        <select name="result" required defaultValue="" className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-ink">
          <option value="" disabled>
            {t("dashboards.engineer.result")}
          </option>
          {RESULTS.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={resultPending}>
          {t("common.submit")}
        </Button>
        {resultState && "error" in resultState && <span className="text-xs text-danger">{resultState.error}</span>}
      </form>
    );
  }

  if (status === "REINSPECTION_REQUIRED") {
    return (
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => startTransition(() => reopenForReinspectionAction(id))}>
        {t("dashboards.engineer.reopen")}
      </Button>
    );
  }

  return null;
}
