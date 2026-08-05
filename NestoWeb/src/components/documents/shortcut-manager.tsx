"use client";

import { useActionState, useTransition } from "react";
import { Link2, X } from "lucide-react";
import { createShortcutAction, removeShortcutAction } from "@/app/actions/documents-module";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

// §16 — folders reference the same document, never copy it. Removing a
// shortcut only ever removes the reference; the server refuses to remove the
// primary placement so a document can't be left with nowhere to live.
export function ShortcutManager({
  documentId,
  placements,
  candidateFolders,
}: {
  documentId: string;
  placements: { folderId: string; folderName: string; isPrimary: boolean }[];
  candidateFolders: { id: string; name: string; depth: number }[];
}) {
  const { t } = useI18n();
  const [, formAction, pending] = useActionState(createShortcutAction, undefined);
  const [isRemoving, startRemove] = useTransition();

  const placedIds = new Set(placements.map((p) => p.folderId));
  const options = candidateFolders.filter((f) => !placedIds.has(f.id));

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {placements.map((p) => (
          <li key={p.folderId} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5 text-ink">
              <Link2 size={13} className="text-ink-faint" />
              {p.folderName}
              {p.isPrimary && (
                <span className="rounded-full bg-gold/10 px-1.5 py-px text-[10px] font-medium text-gold-deep">
                  {t("documents.primary")}
                </span>
              )}
            </span>
            {!p.isPrimary && (
              <button
                type="button"
                disabled={isRemoving}
                onClick={() =>
                  startRemove(async () => {
                    const fd = new FormData();
                    fd.set("documentId", documentId);
                    fd.set("folderId", p.folderId);
                    await removeShortcutAction(undefined, fd);
                  })
                }
                className="text-ink-faint hover:text-danger"
                aria-label={t("documents.removeShortcut")}
              >
                <X size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {options.length > 0 && (
        <form action={formAction} className="flex items-center gap-1.5">
          <input type="hidden" name="documentId" value={documentId} />
          <select
            name="folderId"
            defaultValue=""
            required
            className="h-8 flex-1 rounded-lg border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            <option value="" disabled>
              {t("documents.addShortcut")}
            </option>
            {options.map((f) => (
              <option key={f.id} value={f.id}>
                {" ".repeat(f.depth * 2)}
                {f.name}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {t("documents.addShortcut")}
          </Button>
        </form>
      )}
    </div>
  );
}
