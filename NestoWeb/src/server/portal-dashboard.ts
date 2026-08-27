import { db } from "@/lib/db";
import { listAccessibleProjectIdsForUser } from "@/server/portal-access";

// Phase 8 — the landing console for an external (CLIENT) login.
//
// Before this, DASHBOARD_BY_ROLE sent CLIENT to /dashboard/executive, which
// queries `where: { tenantId }` with no row scoping: a client saw the whole
// company's active-project count, its at-risk/delayed count, its subsidiary
// count, and the five most recent projects *including other clients' names*.
// Finance was already withheld correctly (Audit C1), so this was never a
// money leak — it was a cross-client one.
//
// Everything here is scoped through listAccessibleProjectIdsForUser(), the
// portal grant layer that already existed but had no callers anywhere. No
// grants means no projects: the secure default, not a company-wide view.
export async function getPortalDashboardData(tenantId: string, userId: string) {
  const projectIds = await listAccessibleProjectIdsForUser(tenantId, userId);
  if (projectIds.length === 0) {
    return { projects: [], activeCount: 0, attentionCount: 0, completedCount: 0 };
  }

  const projects = await db.project.findMany({
    where: { tenantId, id: { in: projectIds } },
    // `clientName` is deliberately not selected. On a granted project it would
    // be this viewer's own organization, so it adds nothing — and selecting it
    // is how the executive console leaked other clients' identities.
    select: { id: true, name: true, code: true, status: true, progressPct: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    projects,
    activeCount: projects.filter((p) => p.status !== "ARCHIVED" && p.status !== "COMPLETED").length,
    attentionCount: projects.filter((p) => p.status === "AT_RISK" || p.status === "DELAYED").length,
    completedCount: projects.filter((p) => p.status === "COMPLETED").length,
  };
}
