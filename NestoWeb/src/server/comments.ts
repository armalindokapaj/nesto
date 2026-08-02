import { db } from "@/lib/db";

export async function listComments(tenantId: string, targetType: string, targetId: string) {
  return db.comment.findMany({
    where: { tenantId, targetType, targetId },
    include: { author: true, createdTask: { select: { id: true, code: true, title: true, status: true } } },
    orderBy: { createdAt: "asc" },
  });
}

// Plain (non-mention) comment — used by the Task detail page's Comments tab.
// PRD_3's mention-and-spawn-a-task composer is Client-profile-specific
// (createClientCommentWithMentions); a Task's own comment thread doesn't
// need to spawn another task from itself.
export async function createTaskComment(tenantId: string, authorId: string, taskId: string, body: string) {
  return db.comment.create({
    data: { tenantId, authorId, targetType: "Task", targetId: taskId, body },
  });
}
