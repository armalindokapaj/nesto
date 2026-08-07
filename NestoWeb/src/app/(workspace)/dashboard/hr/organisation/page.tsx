import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { getT } from "@/lib/i18n/server";

// §Organisation — department distribution + the manager reporting line each
// employee actually has (Employee.managerId), not a fabricated org chart
// widget.
export default async function OrganisationPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");

  const employees = await db.employee.findMany({ where: { tenantId }, include: { manager: { select: { fullName: true } } }, orderBy: { department: "asc" } });
  const { t } = await getT();

  const byDepartment = employees.reduce<Record<string, number>>((acc, e) => {
    acc[e.department] = (acc[e.department] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>{t("nav.organisation")}</CardTitle><CardDescription>{t("hrDashboard.organisationSubtitle")}</CardDescription></div></CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {Object.entries(byDepartment).map(([dept, count]) => (
            <div key={dept} className="rounded-lg border border-border px-4 py-2 text-sm">
              <p className="text-ink-faint">{dept}</p>
              <p className="text-lg font-semibold text-ink">{count}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("nav.employees")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("common.name")}</TH><TH>{t("dashboards.hr.department")}</TH><TH>{t("dashboards.hr.position")}</TH><TH>{t("hrDashboard.reportsTo")}</TH></TRow></THead>
            <TBody>
              {employees.map((e) => (
                <TRow key={e.id}>
                  <TD className="font-medium text-ink">{e.fullName}</TD>
                  <TD className="text-ink-muted">{e.department}</TD>
                  <TD className="text-ink-muted">{e.position}</TD>
                  <TD className="text-ink-muted">{e.manager?.fullName ?? "—"}</TD>
                </TRow>
              ))}
              {employees.length === 0 && <TRow><TD colSpan={4} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
