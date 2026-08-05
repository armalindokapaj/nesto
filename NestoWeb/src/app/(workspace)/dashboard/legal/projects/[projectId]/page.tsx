import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getProjectLegalStatus } from "@/server/legal";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { SetReadinessForm } from "@/components/legal/legal-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const GATE_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  READY: "success",
  READY_WITH_CONDITIONS: "warning",
  RESTRICTED: "warning",
  BLOCKED: "danger",
  UNKNOWN: "neutral",
};

// PRD_Government_Legal_Compliance Phase 1 route: /legal/projects/:projectId.
// Projects module is FROZEN — this only reads project id/name/code and never
// links back into the Projects module's own pages/actions.
export default async function ProjectLegalStatusPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "LEGAL", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "LEGAL", "FULL");

  const detail = await getProjectLegalStatus(tenantId, projectId);
  if (!detail) notFound();
  const { project, permits, readiness, activity } = detail;
  const status = readiness?.status ?? "UNKNOWN";
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/legal" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("legal.dashboardTitle")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              {project.code} — {project.name}
            </CardTitle>
            <CardDescription>{t("legal.projectLegalStatusSubtitle")}</CardDescription>
          </div>
          <Badge tone={GATE_TONE[status]}>{t(`legal.readinessStatus_${status}`)}</Badge>
        </CardHeader>
        {canManage && (
          <CardContent>
            <SetReadinessForm projectId={project.id} currentStatus={status} />
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("legal.permitsForProject")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("legal.permitType")}</TH>
                <TH>{t("legal.authority")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("legal.expiryDate")}</TH>
              </TRow>
            </THead>
            <TBody>
              {permits.map((p) => (
                <TRow key={p.id}>
                  <TD>
                    <Link href={`/dashboard/legal/permits/${p.id}`} className="font-medium text-ink hover:text-gold">
                      {t(`legal.permitType_${p.permitType}`)}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">{p.authority.name}</TD>
                  <TD>
                    <Badge tone={p.status === "ISSUED" ? "success" : p.status === "REJECTED" || p.status === "REVOKED" ? "danger" : "neutral"}>
                      {t(`legal.permitStatus_${p.status}`)}
                    </Badge>
                  </TD>
                  <TD className="text-ink-muted">{p.expiryDate ? formatDate(p.expiryDate) : "—"}</TD>
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

      {activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("documents.activity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5 text-xs text-ink-muted">
              {activity.map((event) => (
                <li key={event.id} className="flex items-start gap-2">
                  {event.actor && <Avatar name={event.actor.displayName} color={event.actor.avatarColor ?? undefined} size={20} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-ink">{event.summary}</p>
                    <p className="text-ink-faint">{formatDate(event.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
