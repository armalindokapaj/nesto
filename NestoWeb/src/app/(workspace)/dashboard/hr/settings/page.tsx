import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";

// §Settings — same honest approach as Inventory Settings: real counts of
// this module's own master data plus a link into Platform Configuration,
// no fabricated preferences form.
export default async function HrSettingsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) redirect("/dashboard/hr");

  const [employeeCount, payrollGroupCount, shiftCount] = await Promise.all([
    db.employee.count({ where: { tenantId } }),
    db.payrollGroup.count({ where: { tenantId } }),
    db.shiftDefinition.count({ where: { tenantId } }),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>{t("nav.hrSettings")}</CardTitle><CardDescription>{t("hrDashboard.settingsSubtitle")}</CardDescription></div></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-border/60 py-2">
            <span className="text-ink-muted">{t("nav.employees")}</span>
            <Link href="/dashboard/hr/employees" className="font-semibold text-ink hover:text-gold">{employeeCount}</Link>
          </div>
          <div className="flex items-center justify-between border-b border-border/60 py-2">
            <span className="text-ink-muted">{t("nav.payroll")}</span>
            <span className="font-semibold text-ink">{payrollGroupCount}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/60 py-2">
            <span className="text-ink-muted">{t("nav.shiftsAndRosters")}</span>
            <Link href="/dashboard/hr/shifts" className="font-semibold text-ink hover:text-gold">{shiftCount}</Link>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-ink-muted">{t("nav.setupCenter")}</span>
            <Link href="/dashboard/admin/setup" className="font-semibold text-ink hover:text-gold">{t("common.open")}</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
