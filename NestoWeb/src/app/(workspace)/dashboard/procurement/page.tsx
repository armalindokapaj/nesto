import { redirect } from "next/navigation";
import { Truck, PackageOpen, ClipboardCheck, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getProcurementDashboardData } from "@/server/procurement";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardGreeting } from "@/components/dashboards/dashboard-greeting";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ProcurementDashboardPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");

  const data = await getProcurementDashboardData(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <DashboardGreeting greetingRole="PROCUREMENT" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label={t("dashboards.procurement.totalSuppliers")}
          value={String(data.totalSuppliers)}
          icon={Truck}
          iconColor="#2457C5"
          iconBg="#E4ECFB"
          href="/dashboard/procurement/suppliers"
        />
        <StatTile
          label={t("dashboards.procurement.openOrders")}
          value={String(data.openOrdersCount)}
          icon={PackageOpen}
          iconColor="#4a3aa7"
          iconBg="#EEEAFB"
          href="/dashboard/procurement/orders"
        />
        <StatTile
          label={t("dashboards.procurement.pendingApproval")}
          value={String(data.pendingApprovalCount)}
          icon={ClipboardCheck}
          iconColor="#B76E00"
          iconBg="#FBECD2"
          href="/dashboard/procurement/orders"
        />
        <StatTile
          label={t("dashboards.procurement.committedSpend")}
          value={formatCurrency(data.committedSpend)}
          icon={Wallet}
          iconColor="#1A7F4E"
          iconBg="#E2F4EA"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.procurement.recentOrders")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentOrders.length === 0 ? (
              <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.procurement.noOrders")}</p>
            ) : (
              <ul className="space-y-3">
                {data.recentOrders.map((po) => (
                  <li key={po.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{po.supplier.name}</p>
                      <p className="text-xs text-ink-muted truncate">{po.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-ink">{formatCurrency(po.amount, po.currency)}</p>
                      <Badge status={po.status}>{po.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboards.procurement.recentSuppliers")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentSuppliers.length === 0 ? (
              <p className="text-sm text-ink-faint py-8 text-center">{t("dashboards.procurement.noSuppliers")}</p>
            ) : (
              <ul className="space-y-3">
                {data.recentSuppliers.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{s.name}</p>
                      <p className="text-xs text-ink-muted truncate">{s.category}</p>
                    </div>
                    <span className="text-xs text-ink-faint shrink-0">{formatDate(s.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
