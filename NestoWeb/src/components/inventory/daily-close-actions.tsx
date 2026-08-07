"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmDailyCloseAction } from "@/app/actions/inventory-dashboard";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function DailyCloseActions({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (status === "COMPLETE") return <span className="text-xs text-success">{t("inventoryModule.closed")}</span>;
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={isPending || status === "ATTENTION_REQUIRED"}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await confirmDailyCloseAction(id);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not close.");
            }
          })
        }
      >
        {t("inventoryModule.confirmClose")}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
