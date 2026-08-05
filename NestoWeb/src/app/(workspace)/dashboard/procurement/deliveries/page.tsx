import { redirect } from "next/navigation";
import { AlertTriangle, CalendarDays, PackageCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listDeliveries, listPurchaseOrders } from "@/server/procurement";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { ProcurementStatusControl } from "@/components/procurement/procurement-status-control";
import { CreateDeliveryDialog } from "@/components/procurement/procurement-dialogs";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getConfigResolver } from "@/server/platform-config";

export default async function DeliveriesPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("procurement.page.deliveries")) redirect("/dashboard/procurement");
  const [deliveries, orders] = await Promise.all([listDeliveries(tenantId), listPurchaseOrders(tenantId)]);
  const canWrite = can(role, "PROCUREMENT", "WRITE");
  const eligible = orders.filter((o) => !["DRAFT", "CANCELLED", "ARCHIVED", "CLOSED"].includes(o.status));
  return <div className="space-y-6"><ProcurementPageHeader title="Delivery control" description="Supplier commitments, arrivals and exceptions. Inventory remains authoritative for accepted stock and posted movements." actions={canWrite ? <CreateDeliveryDialog orders={eligible.map((o) => ({ id: o.id, number: o.number, supplier: o.supplier.name }))} /> : undefined} /><ProcurementNav active="delivery" />
    <div className="rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-xs text-ink-muted"><PackageCheck size={15} className="mr-2 inline text-info" /><strong className="text-ink">Receiving boundary:</strong> arrival and supplier exceptions are recorded here; authoritative goods receipt stays in Inventory.</div>
    <Card><CardContent className="p-0"><Table><THead><TRow><TH>Delivery</TH><TH>Purchase order</TH><TH>Supplier</TH><TH>Expected</TH><TH>Location</TH><TH>Exception</TH><TH>Status</TH><TH>Next action</TH></TRow></THead><TBody>{deliveries.map((delivery) => { const overdue = delivery.expectedAt && delivery.expectedAt < new Date() && !["ARRIVED", "ACCEPTED", "REJECTED", "CLOSED"].includes(delivery.status); return <TRow key={delivery.id}><TD className="font-medium text-ink">{delivery.number}<p className="text-[0.68rem] font-normal text-ink-faint">{delivery.lines.length} line(s)</p></TD><TD className="text-ink-muted">{delivery.purchaseOrder.number}</TD><TD className="text-ink-muted">{delivery.supplier.name}</TD><TD className={overdue ? "text-danger" : "text-ink-muted"}>{overdue && <AlertTriangle size={12} className="mr-1 inline" />}{delivery.expectedAt ? <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{formatDate(delivery.expectedAt)}</span> : "—"}</TD><TD className="text-ink-muted">{delivery.deliveryLocation ?? "—"}</TD><TD>{delivery.exceptionType ? <div><Badge status="WARNING">{delivery.exceptionType.replaceAll("_", " ")}</Badge>{delivery.exceptionNote && <p className="mt-1 max-w-48 text-[0.68rem] text-ink-faint">{delivery.exceptionNote}</p>}</div> : "—"}</TD><TD><Badge status={delivery.status}>{delivery.status.replaceAll("_", " ")}</Badge></TD><TD>{canWrite && <ProcurementStatusControl entity="delivery" id={delivery.id} status={delivery.status} />}</TD></TRow>; })}{!deliveries.length && <TRow><TD colSpan={8} className="py-12 text-center text-ink-faint">No deliveries have been scheduled.</TD></TRow>}</TBody></Table></CardContent></Card>
  </div>;
}
