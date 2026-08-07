import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// §13.2 "Service/subcontract receipt is supported without fake Inventory
// movement" — deliveries whose purchase order has at least one SERVICE line.
export default async function ServiceReceiptsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const deliveries = await db.procurementDelivery.findMany({
    where: { tenantId, purchaseOrder: { lines: { some: { lineType: "SERVICE" } } } },
    include: { supplier: true, purchaseOrder: { include: { lines: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Service Receipts" description="Acceptance of service/subcontract work — no Inventory stock movement is created for these." />
      <ProcurementNav active="delivery" />
      <Card><CardContent className="p-0"><Table><THead><TRow><TH>Delivery</TH><TH>Supplier</TH><TH>PO</TH><TH>Status</TH></TRow></THead><TBody>
        {deliveries.map((d) => <TRow key={d.id}><TD className="font-medium text-ink">{d.number}</TD><TD className="text-ink-muted">{d.supplier.name}</TD><TD className="text-ink-muted"><Link href={`/dashboard/procurement/orders/${d.purchaseOrderId}`} className="hover:text-gold hover:underline">{d.purchaseOrder.number}</Link></TD><TD><Badge status={d.status}>{d.status}</Badge></TD></TRow>)}
        {!deliveries.length && <TRow><TD colSpan={4} className="py-12 text-center text-ink-faint">No service receipts yet.</TD></TRow>}
      </TBody></Table></CardContent></Card>
    </div>
  );
}
