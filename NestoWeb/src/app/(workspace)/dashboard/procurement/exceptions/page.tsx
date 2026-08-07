import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

// §7.1 Exception lane — overdue, missing specification, supplier-document
// expiry, budget gap, unacknowledged order and delayed delivery.
export default async function ProcurementExceptionsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const now = new Date();

  const [overdueRequests, unacknowledgedOrders, delayedDeliveries, suspendedSuppliers] = await Promise.all([
    db.purchaseRequest.findMany({ where: { tenantId, archivedAt: null, requiredBy: { lt: now }, status: { notIn: ["CLOSED", "REJECTED", "CANCELLED", "ARCHIVED"] } }, orderBy: { requiredBy: "asc" } }),
    db.purchaseOrder.findMany({ where: { tenantId, archivedAt: null, status: "ISSUED", acknowledgedAt: null }, include: { supplier: true }, orderBy: { issueDate: "asc" } }),
    db.procurementDelivery.findMany({ where: { tenantId, OR: [{ status: "DELAYED" }, { exceptionType: { not: null } }] }, include: { supplier: true }, orderBy: { expectedAt: "asc" } }),
    db.supplier.findMany({ where: { tenantId, status: { in: ["SUSPENDED", "BLACKLISTED"] } } }),
  ]);

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Exceptions" description="Overdue requests, unacknowledged orders, delayed deliveries and supplier suspensions requiring attention." />
      <ProcurementNav active="overview" />

      <Card><CardHeader><CardTitle>Overdue Requests</CardTitle></CardHeader><CardContent className="space-y-2">
        {overdueRequests.length ? overdueRequests.map((r) => <Link key={r.id} href={`/dashboard/procurement/requests/${r.id}`} className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm hover:border-danger"><span className="text-ink">{r.number} — {r.title}</span><span className="text-danger">{r.requiredBy && formatDate(r.requiredBy)}</span></Link>) : <p className="py-4 text-center text-sm text-ink-faint">No overdue requests.</p>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Unacknowledged Purchase Orders</CardTitle></CardHeader><CardContent className="space-y-2">
        {unacknowledgedOrders.length ? unacknowledgedOrders.map((po) => <Link key={po.id} href={`/dashboard/procurement/orders/${po.id}`} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:border-gold"><span className="text-ink">{po.number} — {po.supplier.name}</span><Badge status={po.status}>{po.status}</Badge></Link>) : <p className="py-4 text-center text-sm text-ink-faint">No unacknowledged orders.</p>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Delayed Deliveries</CardTitle></CardHeader><CardContent className="space-y-2">
        {delayedDeliveries.length ? delayedDeliveries.map((d) => <div key={d.id} className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm"><span className="text-ink">{d.number} — {d.supplier.name}</span><span className="text-danger">{d.exceptionType ?? d.status}</span></div>) : <p className="py-4 text-center text-sm text-ink-faint">No delivery exceptions.</p>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Suspended / Blacklisted Suppliers</CardTitle></CardHeader><CardContent className="space-y-2">
        {suspendedSuppliers.length ? suspendedSuppliers.map((s) => <Link key={s.id} href={`/dashboard/procurement/suppliers/${s.id}`} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:border-gold"><span className="text-ink">{s.name}</span><Badge status={s.status}>{s.status}</Badge></Link>) : <p className="py-4 text-center text-sm text-ink-faint">No suspended suppliers.</p>}
      </CardContent></Card>
    </div>
  );
}
