import { db } from "@/lib/db";
import { allocateNumber } from "@/server/number-series";
import { DEPARTMENT_LABELS } from "@/lib/constants";

export type MentionInput = { type: "USER"; userId: string } | { type: "DEPARTMENT"; role: string };

// PRD_3 §5.3 atomic submission. allocateNumber() runs its own short
// transaction first (it can't be nested inside the one below — SQLite via
// Prisma doesn't support concurrent transactions on one connection); the
// comment + task + notifications are then created together so a client
// never ends up with a saved comment but an unknown task state.
export async function createClientCommentWithMentions(
  tenantId: string,
  authorId: string,
  input: {
    clientId: string;
    body: string;
    createTask: boolean;
    mentions: MentionInput[];
    taskTitle?: string;
    priority?: string;
    dueDate?: Date;
  }
) {
  const mentionedUserIds = input.mentions.filter((m) => m.type === "USER").map((m) => m.userId);
  const mentionedDepartments = input.mentions.filter((m) => m.type === "DEPARTMENT").map((m) => m.role);
  const shouldCreateTask = input.createTask && (mentionedUserIds.length > 0 || mentionedDepartments.length > 0);

  const taskCode = shouldCreateTask ? await allocateNumber(tenantId, "TASK") : null;

  const result = await db.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: { tenantId, authorId, targetType: "Client", targetId: input.clientId, body: input.body },
    });

    if (!shouldCreateTask || !taskCode) {
      return { comment, task: null };
    }

    // Department mention: accountable owner, but not necessarily the
    // assignee. Individual mention (no department): direct assignee.
    // Both: department is accountable, individual is initial assignee
    // (PRD_3 §6.3).
    const primaryDepartment = mentionedDepartments[0] ?? null;
    const primaryAssignee = mentionedUserIds[0] ?? null;

    const task = await tx.task.create({
      data: {
        tenantId,
        code: taskCode,
        title: input.taskTitle?.trim() || input.body.slice(0, 120),
        clientId: input.clientId,
        sourceCommentId: comment.id,
        departmentRole: primaryDepartment,
        mainResponsibleId: primaryAssignee,
        priority: input.priority ?? "MEDIUM",
        dueDate: input.dueDate,
        createdById: authorId,
      },
    });

    const recipientIds = new Set<string>(mentionedUserIds);
    if (primaryDepartment) {
      const departmentMembers = await tx.companyMembership.findMany({
        where: { tenantId, role: primaryDepartment },
        select: { userId: true },
      });
      departmentMembers.forEach((m) => recipientIds.add(m.userId));
    }
    // The Sales creator is an automatic watcher (CCT expected result) — they
    // still get a notification confirming the routed task, same as everyone
    // else who needs to know it exists.
    recipientIds.add(authorId);

    if (recipientIds.size > 0) {
      const departmentLabel = primaryDepartment
        ? DEPARTMENT_LABELS[primaryDepartment as keyof typeof DEPARTMENT_LABELS]
        : null;
      await tx.notification.createMany({
        data: Array.from(recipientIds).map((userId) => ({
          tenantId,
          userId,
          type: "CLIENT_REQUEST_TASK",
          title: "New client request",
          body: departmentLabel ? `${task.title} — routed to ${departmentLabel}` : task.title,
          link: `/clients/${input.clientId}`,
        })),
      });
    }

    return { comment, task };
  });

  return result;
}
