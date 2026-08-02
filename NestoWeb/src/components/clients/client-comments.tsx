"use client";

import { ListChecks } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MentionCommentComposer } from "@/components/clients/mention-comment-composer";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

type CommentItem = {
  id: string;
  body: string;
  createdAt: string | Date;
  author: { displayName: string; avatarColor: string };
  createdTask?: { id: string; code: string; title: string; status: string } | null;
};

type Member = { id: string; displayName: string };

export function ClientComments({
  clientId,
  comments,
  canComment,
  canCreateTask,
  members,
}: {
  clientId: string;
  comments: CommentItem[];
  canComment: boolean;
  canCreateTask: boolean;
  members: Member[];
}) {
  const { t } = useI18n();

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
                {c.createdTask && (
                  <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-medium text-gold-strong">
                    <ListChecks size={11} />
                    {t("clients.createdTaskFromComment")}: {c.createdTask.code}
                    <Badge status={c.createdTask.status} className="ml-1">
                      {c.createdTask.status}
                    </Badge>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canComment && <MentionCommentComposer clientId={clientId} members={members} canCreateTask={canCreateTask} />}
    </div>
  );
}
