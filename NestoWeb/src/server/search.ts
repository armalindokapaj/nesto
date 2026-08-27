import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { Resource } from "@/lib/permissions";
import { canViewTask } from "@/lib/project-access";
import type { Role } from "@/lib/constants";

export type SearchResult = {
  id: string;
  type:
    | "project"
    | "task"
    | "invoice"
    | "employee"
    | "client"
    | "contractor"
    | "contract"
    | "supplier"
    | "purchaseRequest"
    | "rfq"
    | "purchaseOrder"
    | "hseReport"
    | "document";
  title: string;
  subtitle?: string;
  href: string;
  locked?: boolean;
};

// Permission-aware global search (Section 28, simplified for Phase 1): every
// result is scoped to the caller's tenant, and result categories the
// caller's role has no READ access to (per lib/permissions) are marked
// `locked` rather than silently omitted, so the UI can show the PRD's
// "locked result, request access" affordance instead of hiding that data
// exists at all. Full per-record visibility overrides (JV sharing, explicit
// grants) are Phase 2+ work — see the deferred-scope note in the build plan.
//
// PRD_10 §12.3/FR-005 — a task's own visibility (PRIVATE/DEPARTMENT_PUBLIC)
// is enforced here too, and the Finance-locked entry never reveals a count
// ("a hidden record must not be discoverable through a count difference").
export async function globalSearch(
  tenantId: string,
  userId: string,
  role: Role,
  query: string
): Promise<SearchResult[]> {
  if (query.trim().length < 2) return [];
  const q = query.trim();

  const [projects, tasks, employees] = await Promise.all([
    db.project.findMany({
      where: { tenantId, name: { contains: q, mode: "insensitive" as const } },
      take: 5,
    }),
    db.task.findMany({
      where: { tenantId, title: { contains: q, mode: "insensitive" as const } },
      take: 10,
      include: { contributions: { select: { userId: true } }, participants: { select: { userId: true, role: true } } },
    }),
    // Company-wide directory — no gate, same precedent as
    // listEmployeeDirectory() in employee-profile.ts.
    db.employee.findMany({
      where: { tenantId, fullName: { contains: q, mode: "insensitive" as const } },
      take: 5,
    }),
  ]);

  const viewer = { userId, role };
  const visibleTasks = tasks.filter((t) => canViewTask(t, viewer)).slice(0, 5);

  const results: SearchResult[] = [
    ...projects.map((p) => ({
      id: p.id,
      type: "project" as const,
      title: p.name,
      subtitle: p.code,
      href: `/projects/${p.id}`,
    })),
    ...visibleTasks.map((t) => ({
      id: t.id,
      type: "task" as const,
      title: t.title,
      subtitle: t.code,
      href: `/tasks/${t.id}`,
    })),
    ...employees.map((e) => ({
      id: e.id,
      type: "employee" as const,
      title: e.fullName,
      subtitle: e.position,
      href: `/employees/${e.id}`,
    })),
  ];

  await addGatedCategory(results, role, "FINANCE", "invoice", "Finance records", () =>
    db.invoice
      .findMany({ where: { tenantId, OR: [{ number: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] }, take: 5 })
      .then((rows) => rows.map((i) => ({ id: i.id, type: "invoice" as const, title: i.number, subtitle: i.description ?? undefined, href: `/dashboard/finance/invoices` }))),
    () => db.invoice.count({ where: { tenantId, OR: [{ number: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] } })
  );

  await addGatedCategory(results, role, "CLIENTS", "client", "Client records", () =>
    db.client
      .findMany({ where: { tenantId, name: { contains: q, mode: "insensitive" as const } }, take: 5 })
      .then((rows) => rows.map((c) => ({ id: c.id, type: "client" as const, title: c.name, subtitle: c.contactName ?? undefined, href: `/clients/${c.id}` }))),
    () => db.client.count({ where: { tenantId, name: { contains: q, mode: "insensitive" as const } } })
  );

  await addGatedCategory(results, role, "COMPANY_NETWORK", "contractor", "Contractor records", () =>
    db.contractor
      .findMany({ where: { tenantId, OR: [{ name: { contains: q, mode: "insensitive" as const } }, { number: { contains: q, mode: "insensitive" as const } }] }, take: 5 })
      .then((rows) => rows.map((c) => ({ id: c.id, type: "contractor" as const, title: c.name, subtitle: c.tradeType, href: `/contractors/${c.id}` }))),
    () => db.contractor.count({ where: { tenantId, OR: [{ name: { contains: q, mode: "insensitive" as const } }, { number: { contains: q, mode: "insensitive" as const } }] } })
  );

  await addGatedCategory(results, role, "CONTRACTS", "contract", "Contract records", () =>
    db.contract
      .findMany({ where: { tenantId, OR: [{ title: { contains: q, mode: "insensitive" as const } }, { number: { contains: q, mode: "insensitive" as const } }] }, take: 5 })
      .then((rows) => rows.map((c) => ({ id: c.id, type: "contract" as const, title: c.title, subtitle: c.number, href: `/contracts` }))),
    () => db.contract.count({ where: { tenantId, OR: [{ title: { contains: q, mode: "insensitive" as const } }, { number: { contains: q, mode: "insensitive" as const } }] } })
  );

  await addGatedCategory(results, role, "PROCUREMENT", "supplier", "Procurement records", () =>
    db.supplier
      .findMany({ where: { tenantId, name: { contains: q, mode: "insensitive" as const } }, take: 5 })
      .then((rows) => rows.map((s) => ({ id: s.id, type: "supplier" as const, title: s.name, subtitle: `${s.number} · ${s.category}`, href: `/dashboard/procurement/suppliers/${s.id}` }))),
    () => db.supplier.count({ where: { tenantId, name: { contains: q, mode: "insensitive" as const } } })
  );

  await addGatedCategory(results, role, "PROCUREMENT", "purchaseRequest", "Procurement records", () =>
    db.purchaseRequest
      .findMany({ where: { tenantId, OR: [{ number: { contains: q, mode: "insensitive" as const } }, { title: { contains: q, mode: "insensitive" as const } }] }, take: 5 })
      .then((rows) => rows.map((r) => ({ id: r.id, type: "purchaseRequest" as const, title: r.title, subtitle: r.number, href: `/dashboard/procurement/requests/${r.id}` }))),
    () => db.purchaseRequest.count({ where: { tenantId, OR: [{ number: { contains: q, mode: "insensitive" as const } }, { title: { contains: q, mode: "insensitive" as const } }] } })
  );

  await addGatedCategory(results, role, "PROCUREMENT", "rfq", "Procurement records", () =>
    db.procurementRfq
      .findMany({ where: { tenantId, OR: [{ number: { contains: q, mode: "insensitive" as const } }, { title: { contains: q, mode: "insensitive" as const } }] }, take: 5 })
      .then((rows) => rows.map((r) => ({ id: r.id, type: "rfq" as const, title: r.title, subtitle: r.number, href: `/dashboard/procurement/sourcing/${r.id}` }))),
    () => db.procurementRfq.count({ where: { tenantId, OR: [{ number: { contains: q, mode: "insensitive" as const } }, { title: { contains: q, mode: "insensitive" as const } }] } })
  );

  await addGatedCategory(results, role, "PROCUREMENT", "purchaseOrder", "Procurement records", () =>
    db.purchaseOrder
      .findMany({ where: { tenantId, OR: [{ number: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] }, take: 5 })
      .then((rows) => rows.map((p) => ({ id: p.id, type: "purchaseOrder" as const, title: p.number, subtitle: p.description, href: `/dashboard/procurement/orders/${p.id}` }))),
    () => db.purchaseOrder.count({ where: { tenantId, OR: [{ number: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] } })
  );

  await addGatedCategory(results, role, "HSE_REPORTS", "hseReport", "HSE reports", () =>
    db.hseReport
      .findMany({ where: { tenantId, title: { contains: q, mode: "insensitive" as const } }, take: 5 })
      .then((rows) => rows.map((h) => ({ id: h.id, type: "hseReport" as const, title: h.title, subtitle: h.severity, href: `/hse-reports` }))),
    () => db.hseReport.count({ where: { tenantId, title: { contains: q, mode: "insensitive" as const } } })
  );

  // Documents — company-visible docs are always searchable; PRIVATE_HR
  // (e.g. work contracts) only surface to HR, matching the exact visibility
  // rule already enforced when reading documents in employee-profile.ts.
  const documentWhere = can(role, "HR", "FULL")
    ? { tenantId, name: { contains: q, mode: "insensitive" as const } }
    : { tenantId, name: { contains: q, mode: "insensitive" as const }, visibility: "COMPANY" };
  const documents = await db.documentFile.findMany({ where: documentWhere, take: 5 });
  results.push(
    ...documents.map((d) => ({
      id: d.id,
      type: "document" as const,
      title: d.name,
      subtitle: d.category,
      href: d.employeeId ? `/employees/${d.employeeId}` : "#",
    }))
  );

  return results;
}

async function addGatedCategory(
  results: SearchResult[],
  role: Role,
  resource: Resource,
  lockedType: SearchResult["type"],
  lockedLabel: string,
  find: () => Promise<SearchResult[]>,
  count: () => Promise<number>
) {
  if (can(role, resource, "READ")) {
    results.push(...(await find()));
    return;
  }
  const n = await count();
  if (n > 0) {
    results.push({ id: `locked-${lockedType}`, type: lockedType, title: lockedLabel, subtitle: "Restricted — request access", href: "#", locked: true });
  }
}
