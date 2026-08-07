import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function ExpectedReceiptsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const deliveries = await db.procurementDelivery.findMany({
    where: { tenantId, status: { notIn: ["ACCEPTED", "REJECTED", "CLOSED"] } },
    include: { supplier: true, purchaseOrder: true },
    orderBy: { expectedAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Expected Receipts" description="Deliveries not yet arrived — Procurement's expectation of what Inventory or the receiving party will confirm." />
      <ProcurementNav active="delivery" />
      <Card><CardContent className="p-0"><Table><THead><TRow><TH>Delivery</TH><TH>Supplier</TH><TH>PO</TH><TH>Expected</TH><TH>Status</TH></TRow></THead><TBody>
        {deliveries.map((d) => <TRow key={d.id}><TD className="font-medium text-ink">{d.number}</TD><TD className="text-ink-muted">{d.supplier.name}</TD><TD className="text-ink-muted"><Link href={`/dashboard/procurement/orders/${d.purchaseOrderId}`} className="hover:text-gold hover:underline">{d.purchaseOrder.number}</Link></TD><TD className="text-ink-muted">{d.expectedAt ? formatDate(d.expectedAt) : "—"}</TD><TD><Badge status={d.status}>{d.status}</Badge></TD></TRow>)}
        {!deliveries.length && <TRow><TD colSpan={5} className="py-12 text-center text-ink-faint">No deliveries expected.</TD></TRow>}
      </TBody></Table></CardContent></Card>
    </div>
  );
}
