import { redirect } from "next/navigation";
import { Mail, MessageCircle, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getNotificationChannelSummary } from "@/server/admin";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { getT } from "@/lib/i18n/server";

export default async function AdminIntegrationsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "READ")) redirect("/dashboard/executive");

  const summary = await getNotificationChannelSummary(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("admin_sub.integrationsTitle")}</CardTitle>
            <CardDescription>{t("admin_sub.integrationsSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              label={t("admin_sub.notificationChannels")}
              value={String(summary.totalUsers)}
              icon={Users}
              iconColor="#2457C5"
              iconBg="#E4ECFB"
              helper={t("dashboards.admin.licensedMembers")}
            />
            <StatTile
              label={t("admin_sub.emailEnabled")}
              value={String(summary.emailEnabled)}
              icon={Mail}
              iconColor="#1A7F4E"
              iconBg="#E2F4EA"
              helper={`${summary.totalUsers > 0 ? Math.round((summary.emailEnabled / summary.totalUsers) * 100) : 0}% ${t("admin_sub.ofUsers")}`}
            />
            <StatTile
              label={t("admin_sub.whatsappEnabled")}
              value={String(summary.whatsappEnabled)}
              icon={MessageCircle}
              iconColor="#1A7F4E"
              iconBg="#E2F4EA"
              helper={`${summary.totalUsers > 0 ? Math.round((summary.whatsappEnabled / summary.totalUsers) * 100) : 0}% ${t("admin_sub.ofUsers")}`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
