"use client";

import { useActionState } from "react";
import { Pin } from "lucide-react";
import { addClientNoteAction } from "@/app/actions/crm-module";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

export type ClientNoteRow = {
  id: string;
  body: string;
  pinned: boolean;
  createdAt: Date | string;
  author: { displayName: string; avatarColor: string | null };
};

// §32 — internal notes, distinct from the Communication log (deferred).
export function ClientNotes({ clientId, notes, canWrite }: { clientId: string; notes: ClientNoteRow[]; canWrite: boolean }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(addClientNoteAction, undefined);

  return (
    <div className="space-y-3">
      {notes.length === 0 ? (
        <p className="text-xs text-ink-faint">{t("crm.noNotes")}</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-2.5">
              <Avatar name={n.author.displayName} color={n.author.avatarColor ?? undefined} size={26} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-ink">{n.author.displayName}</span>
                  <span className="text-[11px] text-ink-faint">{formatDate(n.createdAt)}</span>
                  {n.pinned && <Pin size={11} className="text-gold" />}
                </div>
                <p className="text-sm text-ink-muted">{n.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <form action={formAction} className="flex items-start gap-2 border-t border-border pt-3">
          <input type="hidden" name="clientId" value={clientId} />
          <Textarea name="body" rows={2} placeholder={t("crm.addNotePlaceholder")} className="flex-1" />
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {t("documents.postComment")}
          </Button>
        </form>
      )}
      {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
    </div>
  );
}
