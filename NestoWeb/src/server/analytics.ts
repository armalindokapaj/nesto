import { db } from "@/lib/db";
import { fromMinorUnits } from "@/lib/money";
import { assertTenant } from "@/lib/tenant";
import { listProjects } from "@/server/projects";
import { getBudgetVsActualByProject } from "@/server/finance-dashboard";
import { listEmployees } from "@/server/hr";
import { getProcurementDashboardData } from "@/server/procurement";
import { getWorkProgressDashboard } from "@/server/work-progress";
import { getHseDashboardData } from "@/server/hse";

// PRD_Reporting_Analytics Phase 1 — live-Prisma-query simplification decided
// 2026-08-06: no separate CDC warehouse, every number below is computed on
// request from the same tables the owning module already reads/writes.
// "Permission before aggregation" (see server/executive.ts's Audit C1
// comment) — callers only get the sections they're allowed to see; a
// caller without Finance access gets `finance: null`, not a computed-then-
// discarded number.

async function logActivity(tenantId: string, entityType: string, entityId: string, actorId: string | undefined, eventType: string, summary: string) {
  return db.analyticsActivity.create({ data: { tenantId, entityType, entityId, actorId, eventType, summary } });
}

// The fixed KPI catalogue — "every key KPI has a visible formula, source and
// scope" (a rule repeated in every module PRD built so far). Idempotent
// upsert, safe to call on every dashboard load.
const METRIC_CATALOGUE: { key: string; label: string; description: string; category: string; unit: string; formulaSummary: string; sourceModule: string }[] = [
  { key: "PROJECTS_ACTIVE_COUNT", label: "Active projects", description: "Projects not archived or completed.", category: "PROJECTS", unit: "COUNT", formulaSummary: "count(Project where status not in [ARCHIVED, COMPLETED])", sourceModule: "Projects" },
  { key: "PROJECTS_AT_RISK_COUNT", label: "Projects at risk or delayed", description: "Projects flagged AT_RISK or DELAYED.", category: "PROJECTS", unit: "COUNT", formulaSummary: "count(Project where status in [AT_RISK, DELAYED])", sourceModule: "Projects" },
  { key: "FINANCE_BUDGET_VARIANCE", label: "Budget vs actual variance", description: "Actual revenue recognized against budget, by project.", category: "FINANCE", unit: "CURRENCY", formulaSummary: "sum(Invoice.amount where type=INVOICE) - Project.budget, per project", sourceModule: "Finance" },
  { key: "HR_HEADCOUNT", label: "Active headcount", description: "Employees currently on record.", category: "HR", unit: "COUNT", formulaSummary: "count(Employee)", sourceModule: "HR" },
  { key: "PROCUREMENT_COMMITTED_SPEND", label: "Committed procurement spend", description: "Sum of issued purchase order amounts, not draft or cancelled.", category: "PROCUREMENT", unit: "CURRENCY", formulaSummary: "sum(PurchaseOrder.amount where status not in [DRAFT, CANCELLED, ARCHIVED])", sourceModule: "Procurement" },
  { key: "WORK_PROGRESS_ACCEPTED_PCT", label: "Accepted physical progress", description: "Weighted accepted quantity across all work packages.", category: "WORK_PROGRESS", unit: "PERCENT", formulaSummary: "sum(acceptedQuantity * weight) / sum(approvedQuantity * weight)", sourceModule: "Work Progress" },
  { key: "HSE_OPEN_INCIDENTS", label: "Open HSE incidents", description: "Incidents not yet closed.", category: "HSE", unit: "COUNT", formulaSummary: "count(HseIncident where status != CLOSED)", sourceModule: "HSE" },
];

export async function ensureMetricCatalogue(tenantId: string) {
  await Promise.all(
    METRIC_CATALOGUE.map((m) =>
      db.metricDefinition.upsert({
        where: { tenantId_key: { tenantId, key: m.key } },
        create: { tenantId, ...m },
        update: { label: m.label, description: m.description, category: m.category, unit: m.unit, formulaSummary: m.formulaSummary, sourceModule: m.sourceModule },
      })
    )
  );
  return db.metricDefinition.findMany({ where: { tenantId }, orderBy: [{ category: "asc" }, { label: "asc" }] });
}

// A single scoped read — never called for a caller without the underlying
// module's own READ permission; the page layer decides which flags to pass.
export async function getAnalyticsOverview(
  tenantId: string,
  access: { finance: boolean; hr: boolean; procurement: boolean; workProgress: boolean; hse: boolean }
) {
  const [projects, finance, employees, procurement, workProgress, hse] = await Promise.all([
    listProjects(tenantId),
    access.finance ? getBudgetVsActualByProject(tenantId) : Promise.resolve(null),
    access.hr ? listEmployees(tenantId) : Promise.resolve(null),
    access.procurement ? getProcurementDashboardData(tenantId) : Promise.resolve(null),
    access.workProgress ? getWorkProgressDashboard(tenantId) : Promise.resolve(null),
    access.hse ? getHseDashboardData(tenantId) : Promise.resolve(null),
  ]);

  const activeProjects = projects.filter((p) => p.status !== "ARCHIVED" && p.status !== "COMPLETED");
  const atRiskProjects = projects.filter((p) => p.status === "AT_RISK" || p.status === "DELAYED");

  return {
    projects: { activeCount: activeProjects.length, atRiskCount: atRiskProjects.length, total: projects.length },
    finance: finance ? { rows: finance, totalBudgetMinor: finance.reduce((s, p) => s + p.budgetMinor, 0), totalActualMinor: finance.reduce((s, p) => s + p.actualRevenueMinor, 0) } : null,
    hr: employees ? { headcount: employees.length } : null,
    procurement: procurement ? { committedSpendMinor: procurement.committedSpendMinor, openOrdersCount: procurement.openOrdersCount, qualifiedSuppliers: procurement.qualifiedSuppliers } : null,
    workProgress: workProgress ? { acceptedPct: workProgress.acceptedPct, submittedCount: workProgress.submittedCount } : null,
    hse: hse ? { openHazards: hse.openHazards, openIncidents: hse.openIncidents, activeStopWork: hse.activeStopWork } : null,
  };
}

const REPORT_KINDS = ["PROJECTS_STATUS", "FINANCE_BUDGET_VS_ACTUAL", "HR_HEADCOUNT", "PROCUREMENT_SPEND", "WORK_PROGRESS_STATUS", "HSE_SAFETY"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export function isKnownReportKind(kind: string): kind is ReportKind {
  return (REPORT_KINDS as readonly string[]).includes(kind);
}

export async function listReportDefinitions(tenantId: string) {
  return db.reportDefinition.findMany({
    where: { tenantId, archivedAt: null },
    include: { executions: { orderBy: { executedAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createReportDefinition(tenantId: string, actorId: string, input: { companyId?: string; name: string; description?: string; kind: ReportKind; filtersJson?: string }) {
  const report = await db.reportDefinition.create({ data: { tenantId, createdById: actorId, ...input } });
  await logActivity(tenantId, "ReportDefinition", report.id, actorId, "report.created", `${report.name} (${report.kind}) created.`);
  return report;
}

export async function archiveReportDefinition(tenantId: string, actorId: string, reportId: string) {
  const report = assertTenant(await db.reportDefinition.findUnique({ where: { id: reportId } }), tenantId, "ReportDefinition");
  await db.reportDefinition.update({ where: { id: report.id }, data: { archivedAt: new Date() } });
  await logActivity(tenantId, "ReportDefinition", report.id, actorId, "report.archived", `${report.name} archived.`);
}

/**
 * Executes one of the fixed report kinds live and records that it ran.
 * Rows are always fresh — nothing here is a cache. `access` gates which
 * kinds are actually runnable, mirroring getAnalyticsOverview's scoping.
 */
export async function executeReport(
  tenantId: string,
  actorId: string,
  reportId: string,
  access: { finance: boolean; hr: boolean; procurement: boolean; workProgress: boolean; hse: boolean }
) {
  const report = assertTenant(await db.reportDefinition.findUnique({ where: { id: reportId } }), tenantId, "ReportDefinition");
  let rows: Record<string, unknown>[] = [];

  switch (report.kind) {
    case "PROJECTS_STATUS": {
      const projects = await listProjects(tenantId);
      rows = projects.map((p) => ({ Code: p.code, Name: p.name, Status: p.status, Progress: `${p.progressPct}%` }));
      break;
    }
    case "FINANCE_BUDGET_VS_ACTUAL": {
      if (!access.finance) throw new Error("You do not have Finance access for this report.");
      const finance = await getBudgetVsActualByProject(tenantId);
      // Exported cells are read by a human in a spreadsheet, so they carry the
      // major-unit decimal, not the internal minor-unit integer.
      rows = finance.map((f) => ({ Project: f.name, Budget: fromMinorUnits(f.budgetMinor), "Actual Revenue": fromMinorUnits(f.actualRevenueMinor) }));
      break;
    }
    case "HR_HEADCOUNT": {
      if (!access.hr) throw new Error("You do not have HR access for this report.");
      const employees = await listEmployees(tenantId);
      rows = employees.map((e) => ({ Name: e.fullName, Department: e.department, Position: e.position }));
      break;
    }
    case "PROCUREMENT_SPEND": {
      if (!access.procurement) throw new Error("You do not have Procurement access for this report.");
      const data = await getProcurementDashboardData(tenantId);
      rows = data.recentOrders.map((o) => ({ Number: o.number, Supplier: o.supplier?.name ?? "—", Amount: o.amountMinor, Status: o.status }));
      break;
    }
    case "WORK_PROGRESS_STATUS": {
      if (!access.workProgress) throw new Error("You do not have Work Progress access for this report.");
      const data = await getWorkProgressDashboard(tenantId);
      rows = data.packages.map((p) => ({ Code: p.code, Name: p.name, Status: p.status, "Approved Qty": p.approvedQuantity, "Accepted Qty": p.acceptedQuantity }));
      break;
    }
    case "HSE_SAFETY": {
      if (!access.hse) throw new Error("You do not have HSE access for this report.");
      const data = await getHseDashboardData(tenantId);
      rows = [{ "Open Hazards": data.openHazards, "Active Permits": data.activePermits, "Active Stop-Work": data.activeStopWork, "Open Incidents": data.openIncidents, "Open Observations": data.openObservations, "Open Corrective Actions": data.openActions }];
      break;
    }
    default:
      throw new Error(`Unknown report kind: ${report.kind}`);
  }

  // resultJson is stored on every run (these aggregate result sets are
  // small) so that issuing a snapshot later is just flipping a flag on data
  // that was already frozen at execution time — never a second query.
  const execution = await db.reportExecution.create({ data: { tenantId, reportDefinitionId: report.id, executedById: actorId, rowCount: rows.length, resultJson: JSON.stringify(rows) } });
  await logActivity(tenantId, "ReportDefinition", report.id, actorId, "report.executed", `${report.name} executed, ${rows.length} row(s).`);
  return { rows, executionId: execution.id };
}

export async function listReportExecutions(tenantId: string, reportId: string) {
  return db.reportExecution.findMany({ where: { tenantId, reportDefinitionId: reportId }, include: { executedBy: { select: { displayName: true } } }, orderBy: { executedAt: "desc" }, take: 20 });
}

// ---------------------------------------------------------------------------
// Phase 2/3 — issued/immutable snapshots and currency consolidation. See the
// schema comment above CurrencyRate/ReportExecution.resultJson for scope.
// ---------------------------------------------------------------------------

/** Freezes an already-executed run as a permanent, immutable snapshot — no update path is ever exposed for it after this. */
export async function issueReportExecution(tenantId: string, actorId: string, executionId: string) {
  const execution = assertTenant(await db.reportExecution.findUnique({ where: { id: executionId } }), tenantId, "ReportExecution");
  if (execution.issued) return execution;
  const updated = await db.reportExecution.update({ where: { id: execution.id }, data: { issued: true, issuedAt: new Date(), issuedById: actorId } });
  await logActivity(tenantId, "ReportDefinition", execution.reportDefinitionId, actorId, "report.issued", "A run was issued as a permanent snapshot.");
  return updated;
}

export async function listIssuedReports(tenantId: string) {
  return db.reportExecution.findMany({
    where: { tenantId, issued: true },
    include: { reportDefinition: { select: { name: true, kind: true } }, executedBy: { select: { displayName: true } } },
    orderBy: { issuedAt: "desc" },
  });
}

export async function listCurrencyRates(tenantId: string) {
  return db.currencyRate.findMany({ where: { tenantId }, orderBy: { asOf: "desc" }, take: 50 });
}

export async function setCurrencyRate(tenantId: string, actorId: string, input: { fromCurrency: string; toCurrency: string; rate: number }) {
  return db.currencyRate.create({ data: { tenantId, setById: actorId, ...input } });
}

/** Most-recent rate for the pair; identity for same-currency; null if no rate has ever been set. */
export async function convertAmount(tenantId: string, amount: number, fromCurrency: string, toCurrency: string): Promise<number | null> {
  if (fromCurrency === toCurrency) return amount;
  const rate = await db.currencyRate.findFirst({ where: { tenantId, fromCurrency, toCurrency }, orderBy: { asOf: "desc" } });
  if (!rate) return null;
  return amount * rate.rate;
}

/**
 * Simple linear run-rate forecast: elapsed-time-vs-progress-made, projected
 * forward to 100%. Deliberately not a statistical trend model (that needs a
 * stored progress time series this app doesn't keep) — an honest, auditable
 * heuristic instead of a fabricated black-box number, consistent with the
 * "full calculation trace, no black-box numbers" rule used across the app.
 */
export async function getProjectCompletionForecast(tenantId: string, projectId: string) {
  const project = assertTenant(await db.project.findUnique({ where: { id: projectId } }), tenantId, "Project");
  if (!project.startDate || project.progressPct <= 0 || project.progressPct >= 100) {
    return { forecastDate: null, basis: "insufficient_data" as const };
  }
  const elapsedDays = (Date.now() - project.startDate.getTime()) / (24 * 60 * 60 * 1000);
  const impliedTotalDays = elapsedDays / (project.progressPct / 100);
  const forecastDate = new Date(project.startDate.getTime() + impliedTotalDays * 24 * 60 * 60 * 1000);
  return { forecastDate, basis: "linear_run_rate" as const, elapsedDays: Math.round(elapsedDays), progressPct: project.progressPct };
}

export async function listActiveProjectForecasts(tenantId: string) {
  const projects = await db.project.findMany({ where: { tenantId, status: { in: ["ACTIVE", "ON_TRACK", "AT_RISK", "DELAYED"] } }, select: { id: true, name: true, code: true } });
  const forecasts = await Promise.all(projects.map(async (p) => ({ project: p, forecast: await getProjectCompletionForecast(tenantId, p.id) })));
  return forecasts.filter((f) => f.forecast.forecastDate !== null);
}
