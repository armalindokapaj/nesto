import { db } from "@/lib/db";
import { assertTenant } from "@/lib/tenant";

export async function listHseReports(tenantId: string) {
  return db.hseReport.findMany({
    where: { tenantId },
    include: { project: true, reportedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createHseReport(
  tenantId: string,
  reportedById: string,
  input: { projectId: string; title: string; description: string; severity?: string }
) {
  return db.hseReport.create({ data: { tenantId, reportedById, ...input } });
}

export async function updateHseReportStatus(tenantId: string, reportId: string, status: string) {
  const report = assertTenant(await db.hseReport.findUnique({ where: { id: reportId } }), tenantId, "HseReport");
  return db.hseReport.update({ where: { id: report.id }, data: { status } });
}
