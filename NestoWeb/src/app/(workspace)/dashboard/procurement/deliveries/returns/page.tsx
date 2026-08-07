import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// §13.2 "Return quantity cannot exceed accepted quantity net of prior
// returns" — reads the real rejectedQuantity already tracked on delivery
// lines rather than a separate fabricated Return/Claim model.
export default async function ReturnsAndClaimsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const deliveries = await db.procurementDelivery.findMany({
    where: { tenantId, OR: [{ status: "REJECTED" }, { lines: { some: { rejectedQuantity: { gt: 0 } } } }] },
    include: { supplier: true, purchaseOrder: true, lines: { where: { rejectedQuantity: { gt: 0 } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Returns & Claims" description="Deliveries with rejected quantity — the return/claim record is the delivery line's own rejection, not a duplicated copy." />
      <ProcurementNav active="delivery" />
      <Card><CardContent className="p-0"><Table><THead><TRow><TH>Delivery</TH><TH>Supplier</TH><TH>PO</TH><TH>Rejected Lines</TH><TH>Status</TH></TRow></THead><TBody>
        {deliveries.map((d) => <TRow key={d.id}><TD className="font-medium text-ink">{d.number}</TD><TD className="text-ink-muted">{d.supplier.name}</TD><TD className="text-ink-muted"><Link href={`/dashboard/procurement/orders/${d.purchaseOrderId}`} className="hover:text-gold hover:underline">{d.purchaseOrder.number}</Link></TD><TD className="text-ink-muted">{d.lines.length}</TD><TD><Badge status={d.status}>{d.status}</Badge></TD></TRow>)}
        {!deliveries.length && <TRow><TD colSpan={5} className="py-12 text-center text-ink-faint">No returns or claims.</TD></TRow>}
      </TBody></Table></CardContent></Card>
    </div>
  );
}
