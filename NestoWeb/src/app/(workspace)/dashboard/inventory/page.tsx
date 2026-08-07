import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, PackageCheck, Boxes, Timer } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getInventoryDashboard } from "@/server/inventory-dashboard";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardGreeting } from "@/components/dashboards/dashboard-greeting";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// PRD_Inventory_Dashboard §5 — Primary Cues, Stock Overview, Today's
// Operations (folded into cues/warehouse status here), Warehouse Status,
// Discrepancies & Counts, Work Inbox, Recent Activity.
export default async function InventoryDashboardPage() {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");

  const data = await getInventoryDashboard(tenantId, user.id);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <DashboardGreeting greetingRole="STOCK" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("dashboards.inventory.lowStock")} value={String(data.cues.lowStockCount)} icon={AlertTriangle} iconColor="#B76E00" iconBg="#FBECD2" href="/dashboard/inventory/reorder" />
        <StatTile label={t("dashboards.inventory.movementsToday")} value={String(data.cues.movementsToday)} icon={PackageCheck} iconColor="#2457C5" iconBg="#E4ECFB" href="/dashboard/inventory/receiving" />
        <StatTile label={t("dashboards.inventory.pendingConfirmations")} value={String(data.cues.pendingConfirmations)} icon={Boxes} iconColor="#4a3aa7" iconBg="#EEEAFB" href="/dashboard/inventory/issues" />
        <StatTile label={t("dashboards.inventory.dailyCloseDue")} value={String(data.cues.dailyCloseDue)} icon={Timer} iconColor="#1A7F4E" iconBg="#E2F4EA" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t("dashboards.inventory.stockOverview")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-6 text-sm">
              <div><span className="text-ink-faint">{t("dashboards.inventory.totalOnHand")}: </span><span className="font-semibold text-ink">{data.stockOverview.totalOnHand}</span></div>
              <div><span className="text-ink-faint">{t("dashboards.inventory.totalReserved")}: </span><span className="font-semibold text-ink">{data.stockOverview.totalReserved}</span></div>
            </div>
            <div className="space-y-1">
              {data.stockOverview.lowStock.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm">
                  <span className="text-ink">{b.product.sku} — {b.product.name}</span>
                  <span className="text-ink-muted">{b.warehouse.name}: {b.onHand - b.reserved} / {b.reorderPoint}</span>
                </div>
              ))}
              {data.stockOverview.lowStock.length === 0 && <p className="text-sm text-ink-faint">{t("dashboards.inventory.noLowStock")}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("dashboards.inventory.warehouseStatus")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.warehouseStatus.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">{w.name}</span>
                <span className="text-ink-muted">{w.onHand}</span>
              </div>
            ))}
            {data.warehouseStatus.length === 0 && <p className="text-sm text-ink-faint">{t("common.none")}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>{t("dashboards.inventory.discrepanciesAndCounts")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-ink-muted">{t("dashboards.inventory.openCounts")}: <span className="font-semibold text-ink">{data.discrepanciesAndCounts.openCounts}</span></p>
            {data.discrepanciesAndCounts.dailyCloses.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">{d.warehouse.name}</span>
                <Badge tone={d.status === "COMPLETE" ? "success" : d.status === "ATTENTION_REQUIRED" ? "danger" : "warning"}>{t(`inventoryModule.dailyCloseStatus_${d.status}`)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("dashboards.inventory.workInbox")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.workInbox.map((m) => (
              <Link key={m.id} href={`/dashboard/inventory/movements/${m.id}`} className="block text-sm text-ink hover:text-gold">
                {m.number} — {t(`inventoryModule.movementType_${m.type}`)}
              </Link>
            ))}
            {data.workInbox.length === 0 && <p className="text-sm text-ink-faint">{t("dashboards.workInboxEmpty")}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("dashboards.recentActivity")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.recentActivity.map((a) => (
              <div key={a.id} className="text-sm">
                <span className="text-ink">{a.summary}</span>
                <span className="block text-xs text-ink-faint">{a.actor?.displayName ?? "—"} · {formatDate(a.createdAt)}</span>
              </div>
            ))}
            {data.recentActivity.length === 0 && <p className="text-sm text-ink-faint">{t("common.none")}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
