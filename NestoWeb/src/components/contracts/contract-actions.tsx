"use client";

import { useState, useTransition } from "react";
import { approveContractAction } from "@/app/actions/contracts";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ContractActions({ contractId, status }: { contractId: string; status: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (status !== "DRAFT") return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await approveContractAction(contractId);
            setError(result?.error ?? null);
          })
        }
      >
        {t("contracts.approve")}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
