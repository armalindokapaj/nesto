import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getIncidentDetail, listTenantUsersForPicker } from "@/server/hse";
import { canCloseIncident } from "@/lib/hse";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { IncidentStatusActions, CreateCorrectiveActionForm, CorrectiveActionStatusActions } from "@/components/hse/hse-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  REPORTED: "warning",
  UNDER_INVESTIGATION: "warning",
  ACTION_PENDING: "warning",
  CLOSED: "success",
};

const ACTION_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  OPEN: "warning",
  IN_PROGRESS: "neutral",
  COMPLETED: "success",
};

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "HSE_REPORTS", "WRITE");
  const canClose = can(role, "HSE_REPORTS", "FULL");

  let detail;
  try {
    detail = await getIncidentDetail(tenantId, id);
  } catch {
    return notFound();
  }
  const { incident, activity } = detail;
  const owners = await listTenantUsersForPicker(tenantId);
  const { t } = await getT();
  const openActions = incident.correctiveActions.filter((a) => a.status !== "COMPLETED").length;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/hse/incidents" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("hse.incidentsTitle")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{incident.title}</CardTitle>
              <Badge tone={STATUS_TONE[incident.status]}>{t(`hse.incidentStatus_${incident.status}`)}</Badge>
            </div>
            <CardDescription>
              {t(`hse.incidentClassification_${incident.classification}`)} · {formatDate(incident.occurredAt)}
              {incident.location && ` · ${incident.location}`}
            </CardDescription>
          </div>
          {canWrite && <IncidentStatusActions incidentId={incident.id} status={incident.status} canClose={canClose && canCloseIncident(openActions)} />}
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-ink-muted">
          <p>{incident.description}</p>
          <p>{t("hse.reportedBy")}: {incident.reportedBy.displayName}</p>
          {incident.investigator && <p>{t("hse.investigator")}: {incident.investigator.displayName}</p>}
          {incident.rootCause && <p>{t("hse.rootCause")}: {incident.rootCause}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">{t("hse.correctiveActionsTitle")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {incident.correctiveActions.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm text-ink">{a.description}</p>
                <p className="text-xs text-ink-faint">
                  {t("hse.owner")}: {a.owner.displayName}
                  {a.dueDate && ` · ${t("hse.dueDate")}: ${formatDate(a.dueDate)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={ACTION_STATUS_TONE[a.status]}>{t(`hse.correctiveActionStatus_${a.status}`)}</Badge>
                {canWrite && <CorrectiveActionStatusActions actionId={a.id} status={a.status} incidentId={incident.id} />}
              </div>
            </div>
          ))}
          {incident.correctiveActions.length === 0 && <p className="py-4 text-center text-sm text-ink-faint">{t("hse.noCorrectiveActions")}</p>}
          {canWrite && <CreateCorrectiveActionForm incidentId={incident.id} owners={owners} />}
        </CardContent>
      </Card>

      {activity.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">{t("documents.activity")}</CardTitle></CardHeader>
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
