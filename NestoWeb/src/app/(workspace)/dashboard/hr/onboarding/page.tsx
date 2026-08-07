import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// §Onboarding — real data (hired candidates + new-hire employees in their
// first 30 days), not a fabricated checklist/task-tracker: no onboarding
// task model exists yet, so this stays a status view rather than inventing
// one.
export default async function OnboardingPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [hiredCandidates, newHires] = await Promise.all([
    db.candidate.findMany({ where: { tenantId, stage: "HIRED" }, include: { vacancy: { select: { title: true } } }, orderBy: { updatedAt: "desc" }, take: 20 }),
    db.employee.findMany({ where: { tenantId, hireDate: { gte: thirtyDaysAgo } }, orderBy: { hireDate: "desc" } }),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>{t("nav.onboarding")}</CardTitle><CardDescription>{t("hrDashboard.onboardingSubtitle")}</CardDescription></div></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("common.name")}</TH><TH>{t("dashboards.hr.position")}</TH><TH>{t("dashboards.hr.department")}</TH><TH>{t("hrDashboard.hireDate")}</TH></TRow></THead>
            <TBody>
              {newHires.map((e) => (
                <TRow key={e.id}>
                  <TD className="font-medium text-ink">{e.fullName}</TD>
                  <TD className="text-ink-muted">{e.position}</TD>
                  <TD className="text-ink-muted">{e.department}</TD>
                  <TD className="text-ink-muted">{formatDate(e.hireDate)}</TD>
                </TRow>
              ))}
              {newHires.length === 0 && <TRow><TD colSpan={4} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {hiredCandidates.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("hrDashboard.recentlyHiredCandidates")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {hiredCandidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">{c.fullName}</span>
                <span className="text-ink-muted">{c.vacancy.title}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
