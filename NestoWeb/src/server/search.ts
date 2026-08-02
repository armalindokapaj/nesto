import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/constants";

export type SearchResult = {
  id: string;
  type: "project" | "task" | "invoice";
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
export async function globalSearch(
  tenantId: string,
  role: Role,
  query: string
): Promise<SearchResult[]> {
  if (query.trim().length < 2) return [];
  const q = query.trim();

  const [projects, tasks] = await Promise.all([
    db.project.findMany({
      where: { tenantId, name: { contains: q } },
      take: 5,
    }),
    db.task.findMany({
      where: { tenantId, title: { contains: q } },
      take: 5,
    }),
  ]);

  const results: SearchResult[] = [
    ...projects.map((p) => ({
      id: p.id,
      type: "project" as const,
      title: p.name,
      subtitle: p.code,
      href: `/projects/${p.id}`,
    })),
    ...tasks.map((t) => ({
      id: t.id,
      type: "task" as const,
      title: t.title,
      subtitle: t.code,
      href: `/tasks/${t.id}`,
    })),
  ];

  if (can(role, "FINANCE", "READ")) {
    const invoices = await db.invoice.findMany({
      where: { tenantId, OR: [{ number: { contains: q } }, { description: { contains: q } }] },
      take: 5,
    });
    results.push(
      ...invoices.map((i) => ({
        id: i.id,
        type: "invoice" as const,
        title: i.number,
        subtitle: i.description ?? undefined,
        href: `/dashboard/finance/invoices`,
      }))
    );
  } else {
    const invoiceCount = await db.invoice.count({
      where: { tenantId, OR: [{ number: { contains: q } }, { description: { contains: q } }] },
    });
    if (invoiceCount > 0) {
      results.push({
        id: "locked-finance",
        type: "invoice",
        title: `${invoiceCount} finance record${invoiceCount === 1 ? "" : "s"}`,
        subtitle: "Restricted — request access",
        href: "#",
        locked: true,
      });
    }
  }

  return results;
}
