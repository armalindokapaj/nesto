import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export default async function FrameworkOrdersPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const orders = await db.purchaseOrder.findMany({ where: { tenantId, archivedAt: null, type: "FRAMEWORK" }, include: { supplier: true, project: true }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Framework / Call-Off Orders" description="Purchase orders issued against a standing framework agreement's remaining ceiling." />
      <ProcurementNav active="orders" />
      <Card><CardContent className="p-0"><Table><THead><TRow><TH>Order</TH><TH>Supplier</TH><TH>Context</TH><TH>Value</TH><TH>Status</TH></TRow></THead><TBody>
        {orders.map((po) => <TRow key={po.id}><TD className="font-medium text-ink"><Link href={`/dashboard/procurement/orders/${po.id}`} className="hover:text-gold hover:underline">{po.number}</Link></TD><TD className="text-ink-muted">{po.supplier.name}</TD><TD className="text-ink-muted">{po.project?.name ?? "Company-wide"}</TD><TD className="font-medium text-ink">{formatCurrency(po.amount, po.currency)}</TD><TD><Badge status={po.status}>{po.status}</Badge></TD></TRow>)}
        {!orders.length && <TRow><TD colSpan={5} className="py-12 text-center text-ink-faint">No framework/call-off orders yet.</TD></TRow>}
      </TBody></Table></CardContent></Card>
    </div>
  );
}
