"use client";

import { toggleContractStarAction } from "@/app/actions/contracts-module";
import { StarToggleButton } from "@/components/ui/star-toggle-button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ContractStarButton({ contractId, starred, size = 15 }: { contractId: string; starred: boolean; size?: number }) {
  const { t } = useI18n();
  return (
    <StarToggleButton
      starred={starred}
      size={size}
      starLabel={t("contractsModule.star")}
      unstarLabel={t("contractsModule.unstar")}
      onToggle={() => toggleContractStarAction(contractId)}
    />
  );
}
