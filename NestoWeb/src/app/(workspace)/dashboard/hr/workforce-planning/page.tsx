import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getProjectLabour } from "@/server/hr-timesheets";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { StatTile } from "@/components/ui/stat-tile";
import { Users, BarChart3, Percent } from "lucide-react";
import { getT } from "@/lib/i18n/server";

// §Workforce Planning — Project Labour (Hours/Allocation/Capacity), derived
// only from VERIFIED timesheet hours, never from Work Progress module
// reporting (see hr-timesheets.ts).
export default async function WorkforcePlanningPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const labour = await getProjectLabour(tenantId, monthStart, monthEnd);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label={t("hrDashboard.capacityHours")} value={String(labour.totalCapacityHours)} icon={Users} iconColor="#2457C5" iconBg="#E4ECFB" />
        <StatTile label={t("hrDashboard.allocatedHours")} value={String(labour.allocatedHours)} icon={BarChart3} iconColor="#1A7F4E" iconBg="#E2F4EA" />
        <StatTile label={t("hrDashboard.utilization")} value={`${labour.utilizationPct}%`} icon={Percent} iconColor="#B76E00" iconBg="#FBECD2" />
      </div>

      <Card>
        <CardHeader><div><CardTitle>{t("hrDashboard.hoursByProject")}</CardTitle><CardDescription>{t("hrDashboard.thisMonth")}</CardDescription></div></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("nav.projects")}</TH><TH className="text-right">{t("hrDashboard.hours")}</TH></TRow></THead>
            <TBody>
              {labour.byProject.map((p) => (
                <TRow key={p.projectId}>
                  <TD className="font-medium text-ink">{p.projectName}</TD>
                  <TD className="text-right text-ink">{p.hours}</TD>
                </TRow>
              ))}
              {labour.byProject.length === 0 && <TRow><TD colSpan={2} className="py-8 text-center text-ink-faint">{t("hrDashboard.noVerifiedHours")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
