import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { getT } from "@/lib/i18n/server";

// §Positions — derived from Employee.position (no separate Position master
// yet); groups active headcount per title, real data rather than a
// fabricated job-architecture table.
export default async function PositionsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");

  const employees = await db.employee.findMany({ where: { tenantId, status: "ACTIVE" }, select: { position: true, department: true } });
  const { t } = await getT();

  const byPosition = new Map<string, { position: string; department: string; count: number }>();
  for (const e of employees) {
    const key = `${e.position}::${e.department}`;
    const existing = byPosition.get(key) ?? { position: e.position, department: e.department, count: 0 };
    existing.count += 1;
    byPosition.set(key, existing);
  }
  const rows = Array.from(byPosition.values()).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>{t("nav.positions")}</CardTitle><CardDescription>{t("hrDashboard.positionsSubtitle")}</CardDescription></div></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("dashboards.hr.position")}</TH><TH>{t("dashboards.hr.department")}</TH><TH className="text-right">{t("hrDashboard.headcount")}</TH></TRow></THead>
            <TBody>
              {rows.map((r) => (
                <TRow key={`${r.position}-${r.department}`}>
                  <TD className="font-medium text-ink">{r.position}</TD>
                  <TD className="text-ink-muted">{r.department}</TD>
                  <TD className="text-right text-ink">{r.count}</TD>
                </TRow>
              ))}
              {rows.length === 0 && <TRow><TD colSpan={3} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
