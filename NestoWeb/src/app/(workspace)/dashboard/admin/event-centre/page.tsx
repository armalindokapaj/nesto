import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { ensureEventCatalogue, getNotificationVolume } from "@/server/event-centre";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NotificationPolicyToggle } from "@/components/admin/notification-policy-toggle";
import { getT } from "@/lib/i18n/server";

const SENSITIVITY_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  STANDARD: "neutral",
  INTERNAL: "neutral",
  RESTRICTED: "warning",
  CONFIDENTIAL: "warning",
  LEGAL_PRIVILEGED: "danger",
  PAYROLL_RESTRICTED: "danger",
  MEDICAL_RESTRICTED: "danger",
  EMERGENCY: "danger",
};

// PRD_Notifications_Event_Centre — Phase 1 admin console. "Source modules
// record what happened. The Event Centre interprets communication policy."
// This page is that policy layer's visible surface: the catalogue of known
// events, whether each is mandatory (bypasses per-user mute) or optional,
// and recent in-app delivery volume.
export default async function EventCentrePage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "USER_MANAGEMENT", "FULL");

  const [catalogue, volume] = await Promise.all([ensureEventCatalogue(tenantId), getNotificationVolume(tenantId)]);
  const { t } = await getT();
  const byModule = catalogue.reduce<Record<string, typeof catalogue>>((acc, e) => {
    (acc[e.module] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("eventCentre.title")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("eventCentre.subtitle")}</p>
      </div>

      {volume.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("eventCentre.recentVolume")}</CardTitle>
            <CardDescription>{t("eventCentre.recentVolumeDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {volume.map((v) => (
              <div key={v.type} className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">{v.type}</span>
                <span className="font-medium text-ink">{v.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {Object.entries(byModule).map(([module, entries]) => (
        <Card key={module}>
          <CardHeader>
            <CardTitle className="text-sm">{module}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {entries.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink">{e.label}</p>
                    <Badge tone={SENSITIVITY_TONE[e.sensitivity] ?? "neutral"}>{e.sensitivity}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-faint">{e.description}</p>
                  <p className="mt-0.5 font-mono text-[0.65rem] text-ink-faint">{e.key}</p>
                </div>
                {canManage ? (
                  <NotificationPolicyToggle eventKey={e.key} mandatory={e.policy?.mandatory ?? false} inAppEnabled={e.policy?.inAppEnabled ?? true} />
                ) : (
                  <p className="text-xs text-ink-faint">{e.policy?.inAppEnabled === false ? t("eventCentre.disabled") : t("eventCentre.inAppOn")}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
