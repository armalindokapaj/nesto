"use client";

import { useTransition, useState } from "react";
import { cancelReservationAction } from "@/app/actions/inventory-dashboard";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";
import { toActionError } from "@/lib/errors";

export function ReservationActions({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (status !== "ACTIVE") return null;
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await cancelReservationAction(id);
            } catch (err) {
              setError(toActionError(err, "Could not cancel."));
            }
          })
        }
      >
        {t("common.cancel")}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
