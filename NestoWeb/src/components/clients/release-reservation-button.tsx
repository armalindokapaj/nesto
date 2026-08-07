"use client";

import { useTransition } from "react";
import { releaseReservationAction } from "@/app/actions/crm-module";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ReleaseReservationButton({ relationshipId }: { relationshipId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => startTransition(() => releaseReservationAction(relationshipId))}
    >
      {t("crm.release")}
    </Button>
  );
}
