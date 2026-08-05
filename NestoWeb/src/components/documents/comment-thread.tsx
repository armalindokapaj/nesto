"use client";

import { useActionState } from "react";
import { addDocumentCommentAction } from "@/app/actions/documents-module";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

export type CommentEntry = {
  id: string;
  body: string;
  createdAt: Date | string;
  author: { displayName: string; avatarColor: string | null };
};

// Discussion on the Passport itself — separate from a revision's formal
// approval decision (that's the Blue Ticket flow).
export function CommentThread({ documentId, comments }: { documentId: string; comments: CommentEntry[] }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(addDocumentCommentAction, undefined);

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-xs text-ink-faint">{t("documents.noComments")}</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <Avatar name={c.author.displayName} color={c.author.avatarColor ?? undefined} size={26} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-ink">{c.author.displayName}</span>
                  <span className="text-[11px] text-ink-faint">{formatDate(c.createdAt)}</span>
                </div>
                <p className="text-sm text-ink-muted">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        action={(formData) => {
          formAction(formData);
        }}
        className="flex items-start gap-2 border-t border-border pt-3"
      >
        <input type="hidden" name="documentId" value={documentId} />
        <Textarea name="body" rows={2} placeholder={t("documents.addCommentPlaceholder")} className="flex-1" />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {t("documents.postComment")}
        </Button>
      </form>
      {state && "error" in state && <p className="text-xs text-danger">{state.error}</p>}
    </div>
  );
}
