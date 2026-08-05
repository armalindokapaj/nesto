import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getPermitToWorkDetail } from "@/server/hse";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { PermitToWorkStatusActions } from "@/components/hse/hse-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function PermitToWorkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "HSE_REPORTS", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "HSE_REPORTS", "FULL") || can(role, "HSE_REPORTS", "WRITE");

  const detail = await getPermitToWorkDetail(tenantId, id);
  if (!detail) notFound();
  const { permit, activity } = detail;
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/hse/permits" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("hse.permitsToWorkTitle")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{t(`hse.permitTypeToWork_${permit.permitType}`)}</CardTitle>
              <Badge tone={permit.status === "ACTIVE" ? "success" : permit.status === "SUSPENDED" ? "warning" : "neutral"}>
                {t(`hse.permitToWorkStatus_${permit.status}`)}
              </Badge>
            </div>
            <CardDescription>
              {permit.description}
              {permit.validFrom && ` · ${formatDate(permit.validFrom)}`}
              {permit.validTo && ` – ${formatDate(permit.validTo)}`}
            </CardDescription>
          </div>
          {canManage && <PermitToWorkStatusActions permitId={permit.id} status={permit.status} />}
        </CardHeader>
        <CardContent className="text-sm text-ink-muted">
          {t("hse.issuedBy")}: {permit.issuedBy?.displayName ?? "—"}
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
