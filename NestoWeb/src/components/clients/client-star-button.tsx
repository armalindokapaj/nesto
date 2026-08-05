"use client";

import { toggleClientStarAction } from "@/app/actions/crm-module";
import { StarToggleButton } from "@/components/ui/star-toggle-button";
import { useI18n } from "@/lib/i18n/locale-provider";

export function ClientStarButton({ clientId, starred, size = 15 }: { clientId: string; starred: boolean; size?: number }) {
  const { t } = useI18n();
  return (
    <StarToggleButton
      starred={starred}
      size={size}
      starLabel={t("crm.star")}
      unstarLabel={t("crm.unstar")}
      onToggle={() => toggleClientStarAction(clientId)}
    />
  );
}
