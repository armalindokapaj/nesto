import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listPurchaseOrders, listSuppliers } from "@/server/procurement";
import { listProjects } from "@/server/projects";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { ProcurementStatusControl } from "@/components/procurement/procurement-status-control";
import { CreatePurchaseOrderDialog } from "@/components/procurement/create-purchase-order-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getConfigResolver } from "@/server/platform-config";
import { formatMinor } from "@/lib/money";

export default async function ProcurementOrdersPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("procurement.page.orders")) redirect("/dashboard/procurement");
  const canWrite = can(role, "PROCUREMENT", "WRITE");
  const [orders, suppliers, projects] = await Promise.all([listPurchaseOrders(tenantId), canWrite ? listSuppliers(tenantId) : Promise.resolve([]), canWrite ? listProjects(tenantId) : Promise.resolve([])]);
  const committed = orders.filter((o) => !["DRAFT", "CANCELLED", "ARCHIVED"].includes(o.status)).reduce((sum, o) => sum + o.amount, 0);
  return <div className="space-y-6"><ProcurementPageHeader title="Purchase orders" description="Commercial commitments with immutable issue state, supplier acknowledgment, line totals and fulfillment visibility." actions={canWrite ? <CreatePurchaseOrderDialog suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} projects={projects.map((p) => ({ id: p.id, name: p.name }))} /> : undefined} /><ProcurementNav active="orders" />
    <div className="grid gap-3 sm:grid-cols-4"><Summary label="Open orders" value={orders.filter((o) => !["CLOSED", "CANCELLED"].includes(o.status)).length} /><Summary label="Issued / acknowledged" value={orders.filter((o) => ["ISSUED", "ACKNOWLEDGED"].includes(o.status)).length} /><Summary label="In fulfillment" value={orders.filter((o) => ["PARTIALLY_FULFILLED", "FULFILLED"].includes(o.status)).length} /><Summary label="Committed value" value={formatCurrency(committed)} /></div>
    <Card><CardContent className="p-0"><Table><THead><TRow><TH>Purchase order</TH><TH>Supplier</TH><TH>Project</TH><TH>Value</TH><TH>Delivery</TH><TH>Status</TH><TH>Next action</TH><TH /></TRow></THead><TBody>{orders.map((order) => <TRow key={order.id}><TD><Link href={`/dashboard/procurement/orders/${order.id}`} className="font-medium text-ink hover:text-gold">{order.title ?? order.description}</Link><p className="text-[0.68rem] text-ink-faint">{order.number} · v{order.version} · {order.lines.length || 1} line(s)</p></TD><TD><Link href={`/dashboard/procurement/suppliers/${order.supplier.id}`} className="text-ink-muted hover:text-gold">{order.supplier.name}</Link></TD><TD className="text-ink-muted">{order.project?.name ?? "Company-wide"}</TD><TD className="font-medium text-ink">{formatMinor(order.amount, order.currency)}</TD><TD className="text-ink-muted">{order.requestedDeliveryDate ? formatDate(order.requestedDeliveryDate) : "—"}<p className="text-[0.68rem] text-ink-faint">{order.deliveries.length} schedule(s)</p></TD><TD><Badge status={order.status}>{order.status.replaceAll("_", " ")}</Badge></TD><TD>{canWrite && <ProcurementStatusControl entity="order" id={order.id} status={order.status} />}</TD><TD><Link href={`/dashboard/procurement/orders/${order.id}`} className="text-ink-faint hover:text-gold"><ArrowUpRight size={14} /></Link></TD></TRow>)}{!orders.length && <TRow><TD colSpan={8} className="py-12 text-center text-ink-faint">No purchase orders yet.</TD></TRow>}</TBody></Table></CardContent></Card>
  </div>;
}
function Summary({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-border bg-surface p-4"><p className="text-[0.68rem] uppercase tracking-wide text-ink-faint">{label}</p><p className="mt-1 text-xl font-semibold text-ink">{value}</p></div>; }
