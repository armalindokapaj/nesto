"use client";

import { useActionState, useRef } from "react";
import { createClientCommentAction } from "@/app/actions/clients";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

type CommentItem = {
  id: string;
  body: string;
  createdAt: string | Date;
  author: { displayName: string; avatarColor: string };
};

export function ClientComments({
  clientId,
  comments,
  canComment,
}: {
  clientId: string;
  comments: CommentItem[];
  canComment: boolean;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(createClientCommentAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <p className="text-sm text-ink-faint py-4 text-center">{t("clients.noComments")}</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <Avatar name={c.author.displayName} color={c.author.avatarColor} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-medium text-ink">{c.author.displayName}</p>
                  <p className="text-xs text-ink-faint">{formatDate(c.createdAt, { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <p className="text-sm text-ink-muted mt-0.5 whitespace-pre-wrap">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <form
          ref={formRef}
          action={async (formData) => {
            await formAction(formData);
            formRef.current?.reset();
          }}
          className="space-y-2 pt-3 border-t border-border"
        >
          <input type="hidden" name="clientId" value={clientId} />
          <Textarea name="body" rows={2} placeholder={t("clients.commentPlaceholder")} required />
          {state?.error && <p className="text-xs text-danger">{state.error}</p>}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? t("common.saving") : t("clients.postComment")}
          </Button>
        </form>
      )}
    </div>
  );
}
