import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { Boxes, PackageCheck, ClipboardPen, AlertTriangle } from "lucide-react";
import { getT } from "@/lib/i18n/server";

export default async function InventoryReportsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");

  const [movementsByType, totalOnHand, countsApproved, lowStockCount] = await Promise.all([
    db.inventoryMovement.groupBy({ by: ["type"], where: { tenantId, status: "POSTED" }, _count: { _all: true } }),
    db.stockBalance.aggregate({ where: { tenantId }, _sum: { onHand: true } }),
    db.inventoryCount.count({ where: { tenantId, status: "APPROVED" } }),
    db.stockBalance.count({ where: { tenantId, reorderPoint: { not: null } } }),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t("dashboards.inventory.totalOnHand")} value={String(totalOnHand._sum.onHand ?? 0)} icon={Boxes} iconColor="#2457C5" iconBg="#E4ECFB" />
        <StatTile label={t("nav.counts")} value={String(countsApproved)} icon={ClipboardPen} iconColor="#1A7F4E" iconBg="#E2F4EA" />
        <StatTile label={t("nav.reorder")} value={String(lowStockCount)} icon={AlertTriangle} iconColor="#B76E00" iconBg="#FBECD2" />
        <StatTile label={t("inventoryModule.movements")} value={String(movementsByType.reduce((s, m) => s + m._count._all, 0))} icon={PackageCheck} iconColor="#4a3aa7" iconBg="#EEEAFB" />
      </div>

      <Card>
        <CardHeader><div><CardTitle>{t("inventoryModule.movementsByType")}</CardTitle><CardDescription>{t("inventoryModule.postedOnly")}</CardDescription></div></CardHeader>
        <CardContent className="space-y-2">
          {movementsByType.map((m) => (
            <div key={m.type} className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm">
              <span className="text-ink">{t(`inventoryModule.movementType_${m.type}`)}</span>
              <span className="font-semibold text-ink">{m._count._all}</span>
            </div>
          ))}
          {movementsByType.length === 0 && <p className="text-sm text-ink-faint">{t("common.none")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
