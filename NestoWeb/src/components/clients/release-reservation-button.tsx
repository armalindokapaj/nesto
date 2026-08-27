"use client";

import { useState, useTransition } from "react";
import { releaseReservationAction } from "@/app/actions/crm-module";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ReleaseReservationButton({ relationshipId }: { relationshipId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await releaseReservationAction(relationshipId);
            setError(result && "error" in result ? result.error : null);
          })
        }
      >
        {t("crm.release")}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
