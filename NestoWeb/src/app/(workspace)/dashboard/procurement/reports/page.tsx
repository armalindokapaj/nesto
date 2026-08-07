import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { StatTile } from "@/components/ui/stat-tile";
import { ClipboardList, MessagesSquare, PackageOpen, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export default async function ProcurementReportsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");

  const [requestsByStatus, ordersByStatus, deliveriesByStatus, totalCommitted] = await Promise.all([
    db.purchaseRequest.groupBy({ by: ["status"], where: { tenantId, archivedAt: null }, _count: { _all: true } }),
    db.purchaseOrder.groupBy({ by: ["status"], where: { tenantId, archivedAt: null }, _count: { _all: true } }),
    db.procurementDelivery.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } }),
    db.purchaseOrder.aggregate({ where: { tenantId, archivedAt: null, status: { notIn: ["DRAFT", "CANCELLED", "ARCHIVED"] } }, _sum: { amount: true } }),
  ]);

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Reports" description="Spend, cycle time, delivery and supplier analytics families — every metric drills to source records." />
      <ProcurementNav active="overview" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Requests" value={String(requestsByStatus.reduce((s, r) => s + r._count._all, 0))} icon={ClipboardList} iconColor="#2457C5" iconBg="#E4ECFB" />
        <StatTile label="Purchase Orders" value={String(ordersByStatus.reduce((s, r) => s + r._count._all, 0))} icon={PackageOpen} iconColor="#B76E00" iconBg="#FBECD2" />
        <StatTile label="Deliveries" value={String(deliveriesByStatus.reduce((s, r) => s + r._count._all, 0))} icon={Truck} iconColor="#1A7F4E" iconBg="#E2F4EA" />
        <StatTile label="Committed Value" value={formatCurrency(totalCommitted._sum.amount ?? 0)} icon={MessagesSquare} iconColor="#4a3aa7" iconBg="#EEEAFB" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle>Requests by Status</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{requestsByStatus.map((r) => <div key={r.status} className="flex justify-between"><span className="text-ink-muted">{r.status}</span><span className="font-semibold text-ink">{r._count._all}</span></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Orders by Status</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{ordersByStatus.map((r) => <div key={r.status} className="flex justify-between"><span className="text-ink-muted">{r.status}</span><span className="font-semibold text-ink">{r._count._all}</span></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Deliveries by Status</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{deliveriesByStatus.map((r) => <div key={r.status} className="flex justify-between"><span className="text-ink-muted">{r.status}</span><span className="font-semibold text-ink">{r._count._all}</span></div>)}</CardContent></Card>
      </div>
    </div>
  );
}
