"use client";

import { useTransition } from "react";
import { Star } from "lucide-react";
import { toggleDocumentStarAction } from "@/app/actions/documents-module";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

// DOC-MOD-003 — a private preference. Never touches document status, never
// notifies anyone; purely this user's own shortcut list.
export function DocumentStarButton({
  documentId,
  starred,
  size = 15,
}: {
  documentId: string;
  starred: boolean;
  size?: number;
}) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          await toggleDocumentStarAction(documentId);
        });
      }}
      aria-label={starred ? t("documents.unstarDocument") : t("documents.starDocument")}
      aria-pressed={starred}
      className={cn(
        "shrink-0 transition-colors disabled:opacity-50",
        starred ? "text-gold" : "text-ink-faint hover:text-gold"
      )}
    >
      <Star size={size} fill={starred ? "currentColor" : "none"} />
    </button>
  );
}
