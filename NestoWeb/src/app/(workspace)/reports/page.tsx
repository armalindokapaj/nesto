import { redirect } from "next/navigation";
import { FolderKanban, Wallet, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listProjects } from "@/server/projects";
import { getBudgetVsActualByProject } from "@/server/finance-dashboard";
import { listEmployees } from "@/server/hr";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatMinor } from "@/lib/money";
import { getT } from "@/lib/i18n/server";

export default async function ReportsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");

  const canFinance = can(role, "FINANCE", "READ");
  const canHr = can(role, "HR", "READ");

  const [projects, budgetVsActual, employees] = await Promise.all([
    listProjects(tenantId),
    canFinance ? getBudgetVsActualByProject(tenantId) : Promise.resolve([]),
    canHr ? listEmployees(tenantId) : Promise.resolve([]),
  ]);
  const { t } = await getT();

  const projectRows = projects.map((p) => ({
    Code: p.code,
    Name: p.name,
    Status: p.status,
    Progress: `${p.progressPct}%`,
    Budget: p.budget ? formatCurrency(p.budget) : "—",
  }));

  const financeRows = budgetVsActual.map((p) => ({
    Project: p.name,
    Budget: formatMinor(p.budgetMinor),
    "Actual Revenue": formatMinor(p.actualRevenueMinor),
  }));

  const hrRows = employees.map((e) => ({
    Name: e.fullName,
    Position: e.position,
    Department: e.department,
    Status: e.status,
    "Hire Date": formatDate(e.hireDate),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("reports.title")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("reports.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "#EEEAFB" }}>
                <FolderKanban size={18} color="#4a3aa7" />
              </div>
              <div>
                <CardTitle>{t("reports.projectStatus")}</CardTitle>
                <CardDescription>{t("reports.projectStatusDesc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ExportCsvButton filename="project-status-report" rows={projectRows} />
          </CardContent>
        </Card>

        {canFinance && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "#E2F4EA" }}>
                  <Wallet size={18} color="#1A7F4E" />
                </div>
                <div>
                  <CardTitle>{t("reports.financialSummary")}</CardTitle>
                  <CardDescription>{t("reports.financialSummaryDesc")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ExportCsvButton filename="financial-summary-report" rows={financeRows} />
            </CardContent>
          </Card>
        )}

        {canHr && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "#E4ECFB" }}>
                  <Users size={18} color="#2457C5" />
                </div>
                <div>
                  <CardTitle>{t("reports.hrSummary")}</CardTitle>
                  <CardDescription>{t("reports.hrSummaryDesc")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ExportCsvButton filename="hr-summary-report" rows={hrRows} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
