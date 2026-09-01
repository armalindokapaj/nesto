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
//
// Performance: the sources below used to be five `await`s in a row, and
// because the sidebar badge (countWorkInbox) renders in the workspace layout,
// that serial chain sat on the critical path of EVERY page in the app —
// roughly 900ms of a 1.2s page against a remote database. The where-clauses
// and caps now live in one place so both the list and the badge can fan the
// sources out in parallel, and so the badge can answer with COUNTs instead of
// hydrating rows and their joins.

/** Per-source cap. The badge is `sum(min(matching, cap))`, so the caps have to
 *  be shared by both readers or the number stops matching the list. */
const CAPS = { tasks: 10, invitations: 5, leave: 5, drawings: 5, invoices: 5 } as const;

type Gates = ReturnType<typeof gatesFor>;

function gatesFor(role: Role) {
  return {
    invitations: can(role, "USER_MANAGEMENT", "FULL"),
    leave: can(role, "HR", "FULL"),
    drawings: role === "ARCHITECT" || role === "ENGINEER" || role === "PM",
    invoices: can(role, "FINANCE", "FULL"),
  };
}

function wheres(tenantId: string, userId: string, now: Date) {
  return {
    tasks: {
      tenantId,
      mainResponsibleId: userId,
      OR: [
        { status: "OVERDUE" as const },
        { dueDate: { lt: now }, status: { notIn: ["COMPLETED", "APPROVED", "REJECTED"] } },
      ],
    },
    invitations: { tenantId, status: "PENDING" as const },
    leave: { tenantId, status: "PENDING" as const },
    drawings: { tenantId, status: "IN_REVIEW" as const },
    invoices: { tenantId, type: "INVOICE" as const, status: { in: ["SUBMITTED", "PENDING"] } },
  };
}

export async function getWorkInbox(tenantId: string, userId: string, role: Role): Promise<WorkInboxItem[]> {
  const now = new Date();
  const w = wheres(tenantId, userId, now);
  const gate: Gates = gatesFor(role);

  // All five sources are independent — fan them out rather than chaining them.
  const [myOverdueTasks, pendingInvitations, pendingLeave, pendingDrawings, pendingInvoices] = await Promise.all([
    db.task.findMany({ where: w.tasks, orderBy: { dueDate: "asc" }, take: CAPS.tasks }),
    gate.invitations
      ? db.invitation.findMany({ where: w.invitations, orderBy: { invitedAt: "asc" }, take: CAPS.invitations })
      : Promise.resolve([]),
    gate.leave
      ? db.leaveRequest.findMany({
          where: w.leave,
          include: { employee: true },
          orderBy: { createdAt: "asc" },
          take: CAPS.leave,
        })
      : Promise.resolve([]),
    gate.drawings
      ? db.drawing.findMany({
          where: w.drawings,
          include: { project: true },
          orderBy: { updatedAt: "asc" },
          take: CAPS.drawings,
        })
      : Promise.resolve([]),
    gate.invoices
      ? db.invoice.findMany({ where: w.invoices, orderBy: { issuedDate: "asc" }, take: CAPS.invoices })
      : Promise.resolve([]),
  ]);

  // Assembled in the original order — the Inbox page renders this list as-is.
  const items: WorkInboxItem[] = [];

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

  for (const inv of pendingInvitations) {
    items.push({
      id: `invitation-${inv.id}`,
      category: "REVIEW",
      title: inv.email,
      subtitle: inv.role,
      href: "/dashboard/admin/invitations",
    });
  }

  for (const leave of pendingLeave) {
    items.push({
      id: `leave-${leave.id}`,
      category: "APPROVAL",
      title: leave.employee.fullName,
      subtitle: "Leave request",
      href: "/dashboard/hr/leave",
    });
  }

  for (const d of pendingDrawings) {
    items.push({
      id: `drawing-${d.id}`,
      category: "APPROVAL",
      title: `${d.packageName} · ${d.revisionCode}`,
      subtitle: d.project.name,
      href: "/dashboard/architect/approvals",
    });
  }

  for (const inv of pendingInvoices) {
    items.push({
      id: `invoice-${inv.id}`,
      category: "APPROVAL",
      title: inv.number,
      subtitle: inv.description ?? undefined,
      href: "/dashboard/finance/invoices",
    });
  }

  return items;
}

// The sidebar badge only needs the number, and it is computed on every page
// render — so it asks for COUNTs (no rows, no employee/project joins) and
// clamps each source to the same cap the list uses, which is exactly the
// length getWorkInbox() would have returned.
export async function countWorkInbox(tenantId: string, userId: string, role: Role): Promise<number> {
  const now = new Date();
  const w = wheres(tenantId, userId, now);
  const gate: Gates = gatesFor(role);

  const counts = await Promise.all([
    db.task.count({ where: w.tasks }).then((n) => Math.min(n, CAPS.tasks)),
    gate.invitations
      ? db.invitation.count({ where: w.invitations }).then((n) => Math.min(n, CAPS.invitations))
      : Promise.resolve(0),
    gate.leave ? db.leaveRequest.count({ where: w.leave }).then((n) => Math.min(n, CAPS.leave)) : Promise.resolve(0),
    gate.drawings
      ? db.drawing.count({ where: w.drawings }).then((n) => Math.min(n, CAPS.drawings))
      : Promise.resolve(0),
    gate.invoices ? db.invoice.count({ where: w.invoices }).then((n) => Math.min(n, CAPS.invoices)) : Promise.resolve(0),
  ]);

  return counts.reduce((a, b) => a + b, 0);
}
