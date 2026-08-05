"use client";

import { toggleDocumentStarAction } from "@/app/actions/documents-module";
import { StarToggleButton } from "@/components/ui/star-toggle-button";
import { useI18n } from "@/lib/i18n/locale-provider";

// DOC-MOD-003 — a private preference. Never touches document status, never
// notifies anyone; purely this user's own shortcut list.
export function DocumentStarButton({ documentId, starred, size = 15 }: { documentId: string; starred: boolean; size?: number }) {
  const { t } = useI18n();
  return (
    <StarToggleButton
      starred={starred}
      size={size}
      starLabel={t("documents.starDocument")}
      unstarLabel={t("documents.unstarDocument")}
      onToggle={() => toggleDocumentStarAction(documentId)}
    />
  );
}
