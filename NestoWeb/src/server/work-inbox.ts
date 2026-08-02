import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/constants";

export type WorkInboxItem = {
  id: string;
  category: "APPROVAL" | "TASK_ACTION" | "REVIEW" | "DATA_CORRECTION";
  title: string;
  subtitle?: string;
  href: string;
  dueDate?: Date | null;
};

// PRD_2 §5.1 — the Work Inbox is action-required items, distinct from the
// Notification center (which communicates events). Implemented as a
// computed aggregation over existing tables rather than a separately
// synced WorkInboxItem table: every item here is derived live from the
// same source-of-truth record it points to, so completion is automatic
// the moment that record's status changes — nothing can drift out of sync.
export async function getWorkInbox(tenantId: string, userId: string, role: Role): Promise<WorkInboxItem[]> {
  const now = new Date();
  const items: WorkInboxItem[] = [];

  const myOverdueTasks = await db.task.findMany({
    where: {
      tenantId,
      mainResponsibleId: userId,
      OR: [{ status: "OVERDUE" }, { dueDate: { lt: now }, status: { notIn: ["COMPLETED", "APPROVED", "REJECTED"] } }],
    },
    orderBy: { dueDate: "asc" },
    take: 10,
  });
  for (const task of myOverdueTasks) {
    items.push({
      id: `task-${task.id}`,
      category: "TASK_ACTION",
      title: task.title,
      subtitle: task.code,
      href: task.projectId ? `/projects/${task.projectId}` : "/tasks",
      dueDate: task.dueDate,
    });
  }

  if (can(role, "USER_MANAGEMENT", "FULL")) {
    const pendingInvitations = await db.invitation.findMany({
      where: { tenantId, status: "PENDING" },
      orderBy: { invitedAt: "asc" },
      take: 5,
    });
    for (const inv of pendingInvitations) {
      items.push({
        id: `invitation-${inv.id}`,
        category: "REVIEW",
        title: inv.email,
        subtitle: inv.role,
        href: "/dashboard/admin/invitations",
      });
    }
  }

  if (can(role, "HR", "FULL")) {
    const pendingLeave = await db.leaveRequest.findMany({
      where: { tenantId, status: "PENDING" },
      include: { employee: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    });
    for (const leave of pendingLeave) {
      items.push({
        id: `leave-${leave.id}`,
        category: "APPROVAL",
        title: leave.employee.fullName,
        subtitle: "Leave request",
        href: "/dashboard/hr/leave",
      });
    }
  }

  if (role === "ARCHITECT" || role === "ENGINEER" || role === "PM") {
    const pendingDrawings = await db.drawing.findMany({
      where: { tenantId, status: "IN_REVIEW" },
      include: { project: true },
      orderBy: { updatedAt: "asc" },
      take: 5,
    });
    for (const d of pendingDrawings) {
      items.push({
        id: `drawing-${d.id}`,
        category: "APPROVAL",
        title: `${d.packageName} · ${d.revisionCode}`,
        subtitle: d.project.name,
        href: "/dashboard/architect/approvals",
      });
    }
  }

  if (can(role, "FINANCE", "FULL")) {
    const pendingInvoices = await db.invoice.findMany({
      where: { tenantId, type: "INVOICE", status: { in: ["SUBMITTED", "PENDING"] } },
      orderBy: { issuedDate: "asc" },
      take: 5,
    });
    for (const inv of pendingInvoices) {
      items.push({
        id: `invoice-${inv.id}`,
        category: "APPROVAL",
        title: inv.number,
        subtitle: inv.description ?? undefined,
        href: "/dashboard/finance/invoices",
      });
    }
  }

  return items;
}

export async function countWorkInbox(tenantId: string, userId: string, role: Role): Promise<number> {
  const items = await getWorkInbox(tenantId, userId, role);
  return items.length;
}
