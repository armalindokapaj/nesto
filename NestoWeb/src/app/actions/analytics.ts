"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { assertConfigEnabled } from "@/server/platform-config";
import { createReportDefinition, archiveReportDefinition, executeReport, isKnownReportKind } from "@/server/analytics";

export type AnalyticsActionState = { error?: string; success?: string } | undefined;
const errorState = (e: unknown, fallback: string) => ({ error: e instanceof Error ? e.message : fallback });

// PRD_Reporting_Analytics — read access to the module mirrors whichever
// operational module a report actually touches (checked again inside
// executeReport); creating/archiving a saved report definition needs
// PROJECTS:WRITE, reusing the cross-module resource the existing /reports
// page already gates on rather than growing RESOURCES for a module whose
// PRD explicitly reuses live queries from every other module.
async function context() {
  const c = await getCurrentUser();
  if (!can(c.role, "PROJECTS", "READ")) throw new Error("You do not have permission to view analytics.");
  return c;
}

function accessFor(role: Parameters<typeof can>[0]) {
  return {
    finance: can(role, "FINANCE", "READ"),
    hr: can(role, "HR", "READ"),
    procurement: can(role, "PROCUREMENT", "READ"),
    workProgress: can(role, "PROJECTS", "READ"),
    hse: can(role, "HSE_REPORTS", "READ"),
  };
}

export async function createReportDefinitionAction(_: AnalyticsActionState, formData: FormData): Promise<AnalyticsActionState> {
  try {
    const c = await context();
    if (!can(c.role, "PROJECTS", "WRITE")) throw new Error("You do not have permission to create reports.");
    await assertConfigEnabled(c.tenantId, "analytics.action.create_report", c.company?.id);
    const p = z.object({ name: z.string().min(2), description: z.string().optional(), kind: z.string().min(1) }).safeParse(Object.fromEntries(formData));
    if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid report" };
    if (!isKnownReportKind(p.data.kind)) return { error: "Unknown report kind." };
    await createReportDefinition(c.tenantId, c.user.id, { companyId: c.company?.id, name: p.data.name, description: p.data.description, kind: p.data.kind });
    revalidatePath("/analytics/reports");
    return { success: "Report saved." };
  } catch (e) { return errorState(e, "Could not create report."); }
}

export async function archiveReportDefinitionAction(reportId: string) {
  const c = await context();
  if (!can(c.role, "PROJECTS", "WRITE")) throw new Error("You do not have permission to archive reports.");
  await archiveReportDefinition(c.tenantId, c.user.id, reportId);
  revalidatePath("/analytics/reports");
}

export async function executeReportAction(reportId: string) {
  const c = await context();
  const rows = await executeReport(c.tenantId, c.user.id, reportId, accessFor(c.role));
  revalidatePath("/analytics/reports");
  return rows;
}
