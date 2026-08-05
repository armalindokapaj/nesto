import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getHseDashboardData, listProjectsForPicker, getWorkStartGate } from "@/server/hse";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getT } from "@/lib/i18n/server";

const GATE_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  READY: "success",
  RESTRICTED: "warning",
  BLOCKED: "danger",
  UNKNOWN: "neutral",
};

// PRD_HSE_Module Phase 1 — /hse route. Surfaces the Phase-1 work-start
// safety gate heuristic per project alongside open hazards / active permits
// to work / active stop-work orders.
export default async function HseDashboardPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "READ")) redirect("/dashboard/executive");

  const [summary, projects] = await Promise.all([getHseDashboardData(tenantId), listProjectsForPicker(tenantId)]);
  const gates = await Promise.all(projects.map(async (p) => ({ project: p, gate: await getWorkStartGate(tenantId, p.id) })));
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("hse.dashboardTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("hse.dashboardSubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-ink-faint">{t("hse.activeHazards")}</p>
            <p className="text-2xl font-semibold text-warning mt-1">{summary.openHazards}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-ink-faint">{t("hse.activePermits")}</p>
            <p className="text-2xl font-semibold text-ink mt-1">{summary.activePermits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-ink-faint">{t("hse.activeStopWork")}</p>
            <p className="text-2xl font-semibold text-danger mt-1">{summary.activeStopWork}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-sm">{t("hse.workStartGate")}</CardTitle>
            <CardDescription>{t("hse.hierarchyHint")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("legal.project")}</TH>
                <TH>{t("hse.workStartGate")}</TH>
                <TH>{t("hse.reason")}</TH>
              </TRow>
            </THead>
            <TBody>
              {gates.map(({ project, gate }) => (
                <TRow key={project.id}>
                  <TD className="font-medium text-ink">
                    {project.code} — {project.name}
                  </TD>
                  <TD>
                    <Badge tone={GATE_TONE[gate.status]}>{t(`hse.gateStatus_${gate.status}`)}</Badge>
                  </TD>
                  <TD className="text-ink-muted">{gate.reason}</TD>
                </TRow>
              ))}
              {gates.length === 0 && (
                <TRow>
                  <TD colSpan={3} className="py-8 text-center text-ink-faint">
                    {t("legal.noProjects")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/hse/hazards" className="text-sm text-gold hover:underline">
          {t("hse.hazardsTitle")}
        </Link>
        <span className="text-ink-faint">·</span>
        <Link href="/dashboard/hse/permits" className="text-sm text-gold hover:underline">
          {t("hse.permitsToWorkTitle")}
        </Link>
        <span className="text-ink-faint">·</span>
        <Link href="/dashboard/hse/stop-work" className="text-sm text-gold hover:underline">
          {t("hse.stopWorkTitle")}
        </Link>
        <span className="text-ink-faint">·</span>
        <Link href="/hse-reports" className="text-sm text-gold hover:underline">
          {t("nav.hseReports")}
        </Link>
      </div>
    </div>
  );
}
