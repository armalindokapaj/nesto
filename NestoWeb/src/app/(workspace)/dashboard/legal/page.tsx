import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listPermits, listProjectsForPicker, listReadinessStatuses } from "@/server/legal";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const GATE_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  READY: "success",
  READY_WITH_CONDITIONS: "warning",
  RESTRICTED: "warning",
  BLOCKED: "danger",
  UNKNOWN: "neutral",
};

// PRD_Government_Legal_Compliance Phase 1 — /legal route. Surfaces the
// Work-Blocking Legal Readiness Gate per project and the permit register;
// Projects module is FROZEN so this reads project id/name/code only, never
// links into (or modifies) the Projects module's own pages.
export default async function LegalDashboardPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "LEGAL", "READ")) redirect("/dashboard/executive");

  const [permits, projects, readinessStatuses] = await Promise.all([
    listPermits(tenantId),
    listProjectsForPicker(tenantId),
    listReadinessStatuses(tenantId),
  ]);
  const { t } = await getT();

  const statusByProject = new Map(readinessStatuses.map((r) => [r.projectId, r]));
  const expiringPermits = permits.filter((p) => p.status === "ISSUED" && p.expiryDate && p.expiryDate < new Date());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("legal.dashboardTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("legal.dashboardSubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-ink-faint">{t("legal.totalPermits")}</p>
            <p className="text-2xl font-semibold text-ink mt-1">{permits.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-ink-faint">{t("legal.issuedPermits")}</p>
            <p className="text-2xl font-semibold text-ink mt-1">{permits.filter((p) => p.status === "ISSUED").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-ink-faint">{t("legal.expiredPermits")}</p>
            <p className="text-2xl font-semibold text-danger mt-1">{expiringPermits.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-sm">{t("legal.readinessGate")}</CardTitle>
            <CardDescription>{t("legal.readinessGateSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("legal.project")}</TH>
                <TH>{t("legal.readinessGate")}</TH>
                <TH>{t("common.notes")}</TH>
              </TRow>
            </THead>
            <TBody>
              {projects.map((p) => {
                const readiness = statusByProject.get(p.id);
                const status = readiness?.status ?? "UNKNOWN";
                return (
                  <TRow key={p.id}>
                    <TD>
                      <Link href={`/dashboard/legal/projects/${p.id}`} className="font-medium text-ink hover:text-gold">
                        {p.code} — {p.name}
                      </Link>
                    </TD>
                    <TD>
                      <Badge tone={GATE_TONE[status]}>{t(`legal.readinessStatus_${status}`)}</Badge>
                    </TD>
                    <TD className="text-ink-muted">{readiness?.reason ?? "—"}</TD>
                  </TRow>
                );
              })}
              {projects.length === 0 && (
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("legal.recentPermits")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("legal.permitType")}</TH>
                <TH>{t("legal.authority")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
              </TRow>
            </THead>
            <TBody>
              {permits.slice(0, 8).map((p) => (
                <TRow key={p.id}>
                  <TD>
                    <Link href={`/dashboard/legal/permits/${p.id}`} className="font-medium text-ink hover:text-gold">
                      {t(`legal.permitType_${p.permitType}`)}
                      {p.referenceNumber ? ` · ${p.referenceNumber}` : ""}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{p.authority.name}</TD>
                  <TD>
                    <Badge tone={p.status === "ISSUED" ? "success" : p.status === "REJECTED" || p.status === "REVOKED" ? "danger" : "neutral"}>
                      {t(`legal.permitStatus_${p.status}`)}
                    </Badge>
                  </TD>
                  <TD className="text-ink-muted">{formatDate(p.createdAt)}</TD>
                </TRow>
              ))}
              {permits.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-8 text-center text-ink-faint">
                    {t("legal.noPermits")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
