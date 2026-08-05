"use client";

import { useState, useTransition } from "react";
import { postJournalEntryAction, reverseJournalEntryAction } from "@/app/actions/finance-module";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function JournalEntryActions({ journalEntryId, status }: { journalEntryId: string; status: string }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not complete this action.");
      }
    });
  }

  if (status === "REVERSED") return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {status !== "POSTED" && (
          <Button size="sm" disabled={isPending} onClick={() => run(() => postJournalEntryAction(journalEntryId))}>
            {t("financeModule.post")}
          </Button>
        )}
        {status === "POSTED" && (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run(() => reverseJournalEntryAction(journalEntryId))}>
            {t("financeModule.reverse")}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
