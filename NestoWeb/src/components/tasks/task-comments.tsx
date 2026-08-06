"use client";

// PRD_Tasks_Module — every task gets threaded comments, not just tasks under
// PRD_4 cross-department orchestration. Reuses the existing generic
// Comment(targetType="Task") system and createTaskCommentAction — same data
// task-orchestration-view.tsx already renders for orchestrated tasks, just
// available before orchestration starts too.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTaskCommentAction } from "@/app/actions/task-orchestration";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

type CommentEntry = { id: string; body: string; createdAt: Date | string; author: { displayName: string; avatarColor: string } };

export function TaskComments({ taskId, comments }: { taskId: string; comments: CommentEntry[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5">
            <Avatar name={c.author.displayName} color={c.author.avatarColor} size={26} />
            <div>
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-medium text-ink">{c.author.displayName}</p>
                <p className="text-xs text-ink-faint">{formatDate(c.createdAt, { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <p className="text-sm text-ink-muted whitespace-pre-wrap">{c.body}</p>
            </div>
          </li>
        ))}
        {comments.length === 0 && <p className="text-sm text-ink-faint text-center py-4">{t("clients.noComments")}</p>}
      </ul>
      <div className="space-y-2 pt-3 border-t border-border">
        <Textarea rows={2} placeholder={t("clients.commentPlaceholder")} value={body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)} />
        <Button
          size="sm"
          disabled={pending || !body.trim()}
          onClick={() =>
            startTransition(async () => {
              const formData = new FormData();
              formData.set("taskId", taskId);
              formData.set("body", body);
              await createTaskCommentAction(undefined, formData);
              setBody("");
              router.refresh();
            })
          }
        >
          {t("clients.postComment")}
        </Button>
      </div>
    </div>
  );
}
