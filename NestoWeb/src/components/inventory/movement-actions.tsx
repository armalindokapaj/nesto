"use client";

import { useState, useTransition } from "react";
import { postMovementAction, reverseMovementAction } from "@/app/actions/inventory-module";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";
import { toActionError } from "@/lib/errors";

export function MovementActions({ movementId, status }: { movementId: string; status: string }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(toActionError(err, "Could not complete this action."));
      }
    });
  }

  if (status === "REVERSED" || status === "CANCELLED") return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {status !== "POSTED" && (
          <Button size="sm" disabled={isPending} onClick={() => run(() => postMovementAction(movementId))}>
            {t("inventoryModule.post")}
          </Button>
        )}
        {status === "POSTED" && (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run(() => reverseMovementAction(movementId))}>
            {t("inventoryModule.reverse")}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
