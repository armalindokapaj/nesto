import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getPermitDetail } from "@/server/legal";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { AddPermitConditionForm, AmendPermitForm, PermitStatusActions } from "@/components/legal/legal-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function PermitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "LEGAL", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "LEGAL", "FULL");
  const canWrite = can(role, "LEGAL", "WRITE");

  const detail = await getPermitDetail(tenantId, id);
  if (!detail) notFound();
  const { permit, project, activity } = detail;
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/legal/permits" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("legal.permitsTitle")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>
                {t(`legal.permitType_${permit.permitType}`)}
                {permit.referenceNumber ? ` · ${permit.referenceNumber}` : ""}
              </CardTitle>
              <Badge tone={permit.status === "ISSUED" ? "success" : permit.status === "REJECTED" || permit.status === "REVOKED" ? "danger" : "neutral"}>
                {t(`legal.permitStatus_${permit.status}`)}
              </Badge>
            </div>
            <CardDescription>
              {permit.authority.name}
              {project && (
                <>
                  {" · "}
                  <Link href={`/dashboard/legal/projects/${project.id}`} className="hover:text-gold hover:underline">
                    {project.code} — {project.name}
                  </Link>
                </>
              )}
              {permit.issuedDate && ` · ${t("legal.issuedOn")} ${formatDate(permit.issuedDate)}`}
              {permit.expiryDate && ` · ${t("legal.expiryDate")} ${formatDate(permit.expiryDate)}`}
            </CardDescription>
          </div>
          {canManage && <PermitStatusActions permitId={permit.id} status={permit.status} />}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("legal.conditions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {permit.conditions.length === 0 && <p className="text-sm text-ink-faint">{t("legal.noConditions")}</p>}
          <ul className="space-y-2">
            {permit.conditions.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="text-ink">{c.description}</span>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  {c.dueDate && <span>{formatDate(c.dueDate)}</span>}
                  <Badge tone={c.status === "SATISFIED" ? "success" : c.status === "OVERDUE" ? "danger" : "neutral"}>
                    {t(`legal.conditionStatus_${c.status}`)}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
          {canWrite && <AddPermitConditionForm permitId={permit.id} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("legal.amendments")}</CardTitle>
          <CardDescription>{t("legal.amendmentsSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {permit.amendments.length === 0 && <p className="text-sm text-ink-faint">{t("legal.noAmendments")}</p>}
          <ul className="space-y-2">
            {permit.amendments.map((a) => (
              <li key={a.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <p className="text-ink">{a.description}</p>
                <p className="text-xs text-ink-faint mt-0.5">
                  {a.createdBy.displayName} · {formatDate(a.createdAt)}
                  {a.newExpiryDate && ` · ${t("legal.newExpiryDate")}: ${formatDate(a.newExpiryDate)}`}
                </p>
              </li>
            ))}
          </ul>
          {canManage && permit.status === "ISSUED" && <AmendPermitForm permitId={permit.id} />}
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
