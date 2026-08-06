import { redirect } from "next/navigation";
import { Laptop, Package, Ticket } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getConfigResolver } from "@/server/platform-config";
import { getItDashboard } from "@/server/it-admin";
import { StatTile } from "@/components/ui/stat-tile";
import { getT } from "@/lib/i18n/server";

export default async function ItAdminDashboardPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "COMPANY_SETTINGS", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("it_admin.page.dashboard")) redirect("/dashboard/executive");

  const dashboard = await getItDashboard(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("itAdmin.title")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("itAdmin.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label={t("itAdmin.devices")} value={String(dashboard.deviceCount)} icon={Laptop} href="/dashboard/admin/it/devices" />
        <StatTile label={t("itAdmin.licences")} value={String(dashboard.licenceCount)} icon={Package} href="/dashboard/admin/it/licences" />
        <StatTile label={t("itAdmin.tickets")} value={String(dashboard.openTickets)} icon={Ticket} href="/dashboard/admin/it/tickets" />
      </div>
    </div>
  );
}
