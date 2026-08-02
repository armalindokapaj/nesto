import { db } from "@/lib/db";

export async function getArchitectDashboardData(tenantId: string) {
  const [drawings, rfis, projects] = await Promise.all([
    db.drawing.findMany({
      where: { tenantId },
      include: { project: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.rFI.findMany({ where: { tenantId }, include: { project: true }, orderBy: { createdAt: "desc" } }),
    db.project.count({ where: { tenantId, status: { not: "ARCHIVED" } } }),
  ]);

  const openRfis = rfis.filter((r) => r.status === "OPEN" || r.status === "OVERDUE");
  const pendingApprovals = drawings.filter((d) => d.status === "IN_REVIEW");

  const statusBreakdown = drawings.reduce<Record<string, number>>((acc, d) => {
    const label = d.status.replace("_", " ");
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  return {
    activeProjects: projects,
    pendingDrawings: drawings.filter((d) => d.status !== "APPROVED").length,
    openRfisCount: openRfis.length,
    revisionsAwaiting: pendingApprovals.length,
    drawingPackages: drawings.slice(0, 6),
    recentRfis: rfis.slice(0, 4),
    totalPackages: drawings.length,
    statusBreakdown: Object.entries(statusBreakdown).map(([label, value]) => ({ label, value })),
  };
}

export async function listDrawings(tenantId: string, status?: string) {
  return db.drawing.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    include: { project: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listRfis(tenantId: string, status?: string) {
  return db.rFI.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    include: { project: true },
    orderBy: { createdAt: "desc" },
  });
}
