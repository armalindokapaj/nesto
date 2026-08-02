import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listEmployees } from "@/server/hr";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DonutChart } from "@/components/ui/charts/donut-chart";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function HrReportsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");

  const employees = await listEmployees(tenantId);
  const { t } = await getT();

  const distribution = employees.reduce<Record<string, number>>((acc, e) => {
    acc[e.department] = (acc[e.department] ?? 0) + 1;
    return acc;
  }, {});

  const rows = employees.map((e) => ({
    Name: e.fullName,
    Position: e.position,
    Department: e.department,
    Status: e.status,
    "Hire Date": formatDate(e.hireDate),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("hr_sub.reportsTitle")}</h1>
        </div>
        <ExportCsvButton filename="hr-employee-report" rows={rows} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.hr.employeeDistribution")}</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(distribution).length > 0 ? (
              <DonutChart
                data={Object.entries(distribution).map(([label, value]) => ({ label, value }))}
                centerLabel={t("dashboards.hr.employees")}
                centerValue={String(employees.length)}
              />
            ) : (
              <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.hr.noDepartments")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
