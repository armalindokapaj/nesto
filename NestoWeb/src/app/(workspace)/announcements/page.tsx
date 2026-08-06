import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { hasCapability } from "@/server/capabilities";
import { listAnnouncements, listEmergencyAlerts } from "@/server/event-centre";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CreateAnnouncementDialog,
  AcknowledgeButton,
  ActivateAlertDialog,
  ResolveAlertButton,
} from "@/components/announcements/announcement-dialogs";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function AnnouncementsPage() {
  const { tenantId, role, user } = await getCurrentUser();
  const canManage = can(role, "USER_MANAGEMENT", "FULL");
  const canActivateAlert = await hasCapability(tenantId, user.id, role, "notifications.emergency_alert.activate");

  const [announcements, alerts] = await Promise.all([listAnnouncements(tenantId), listEmergencyAlerts(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("announcements.title")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("announcements.subtitle")}</p>
        </div>
        {canManage && <CreateAnnouncementDialog />}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{t("announcements.emergencyAlerts")}</CardTitle>
            {canActivateAlert && <ActivateAlertDialog />}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger-soft/40 p-3">
              <div>
                <p className="text-sm font-semibold text-ink">🚨 {a.title}</p>
                <p className="text-xs text-ink-muted mt-0.5">{a.body}</p>
                <p className="text-xs text-ink-faint mt-1">{formatDate(a.activatedAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={a.resolvedAt ? "neutral" : "danger"}>{a.resolvedAt ? t("announcements.resolved") : t("announcements.active")}</Badge>
                {!a.resolvedAt && canActivateAlert && <ResolveAlertButton alertId={a.id} />}
              </div>
            </div>
          ))}
          {alerts.length === 0 && <p className="text-sm text-ink-faint">{t("announcements.noAlerts")}</p>}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {announcements.map((a) => {
          const acked = a.acks.some((ack) => ack.userId === user.id);
          return (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{a.title}</CardTitle>
                  {a.mandatoryAck && <Badge tone={acked ? "success" : "warning"}>{acked ? t("announcements.acknowledged") : t("announcements.mandatoryAck")}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-ink">{a.body}</p>
                <div className="flex items-center justify-between text-xs text-ink-faint">
                  <span>{formatDate(a.publishedAt)} · {a.acks.length} {t("announcements.ackCount")}</span>
                  {a.mandatoryAck && !acked && <AcknowledgeButton announcementId={a.id} />}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {announcements.length === 0 && (
          <Card><CardContent className="py-8 text-center text-ink-faint">{t("announcements.noAnnouncements")}</CardContent></Card>
        )}
      </div>
    </div>
  );
}
