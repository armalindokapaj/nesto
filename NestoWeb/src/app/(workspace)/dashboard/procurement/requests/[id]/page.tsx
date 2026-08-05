import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getPurchaseRequest, listProcurementActivity } from "@/server/procurement";
import { ProcurementNav } from "@/components/procurement/procurement-nav";
import { ProcurementStatusControl } from "@/components/procurement/procurement-status-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getConfigResolver } from "@/server/platform-config";

export default async function PurchaseRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("procurement.page.requests")) redirect("/dashboard/procurement");
  const [request, activity] = await Promise.all([getPurchaseRequest(tenantId, id), listProcurementActivity(tenantId, "PURCHASE_REQUEST", id)]);
  const canWrite = can(role, "PROCUREMENT", "WRITE");
  return <div className="space-y-6">
    <Link href="/dashboard/procurement/requests" className="inline-flex items-center gap-1.5 text-sm text-ink-muted"><ArrowLeft size={14} /> Purchase requests</Link>
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-gold">{request.number}</span><Badge status={request.status}>{request.status.replaceAll("_", " ")}</Badge><Badge status={request.priority}>{request.priority}</Badge></div><h1 className="mt-2 text-2xl font-semibold text-ink">{request.title}</h1><p className="mt-2 max-w-3xl text-sm text-ink-muted">{request.justification ?? "No business justification recorded."}</p><div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-muted"><span>{request.project?.name ?? "Company-wide"}</span>{request.requiredBy && <span className="inline-flex items-center gap-1"><CalendarDays size={12} />Required {formatDate(request.requiredBy)}</span>}{request.deliveryLocation && <span className="inline-flex items-center gap-1"><MapPin size={12} />{request.deliveryLocation}</span>}</div></div>{canWrite && <ProcurementStatusControl entity="request" id={request.id} status={request.status} />}</div>
    <ProcurementNav active="requests" />
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]"><Card><CardHeader><CardTitle>Requested scope</CardTitle></CardHeader><CardContent className="p-0 pt-4"><Table><THead><TRow><TH>#</TH><TH>Description</TH><TH>Type</TH><TH>Quantity</TH><TH>Unit cost</TH><TH>Total</TH></TRow></THead><TBody>{request.lines.map((line) => <TRow key={line.id}><TD>{line.lineNumber}</TD><TD className="font-medium text-ink">{line.description}{line.specification && <p className="text-xs font-normal text-ink-faint">{line.specification}</p>}</TD><TD className="text-ink-muted">{line.lineType}</TD><TD>{line.quantity} {line.unit}</TD><TD>{formatCurrency(line.estimatedUnitCost, request.currency)}</TD><TD className="font-medium text-ink">{formatCurrency(line.quantity * line.estimatedUnitCost, request.currency)}</TD></TRow>)}</TBody></Table></CardContent></Card><Card><CardHeader><CardTitle>Control summary</CardTitle></CardHeader><CardContent className="space-y-3"><Row label="Estimated total" value={formatCurrency(request.estimatedAmount, request.currency)} /><Row label="Request type" value={request.type.replaceAll("_", " ")} /><Row label="Category" value={request.category ?? "—"} /><Row label="Requester" value={request.createdBy.displayName} /><Row label="Version" value={request.version} /><Row label="Package" value={request.package?.number ?? "Not allocated"} /><Row label="RFQs" value={request.rfqs.length} /><Row label="Purchase orders" value={request.purchaseOrders.length} /></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Immutable activity</CardTitle></CardHeader><CardContent>{activity.length ? <ul className="space-y-4">{activity.map((event) => <li key={event.id} className="flex gap-3"><span className="mt-1.5 h-2 w-2 rounded-full bg-gold" /><div><p className="text-sm text-ink">{event.summary}</p><p className="text-[0.68rem] text-ink-faint">{event.actor.displayName} · {formatDate(event.createdAt)}</p></div></li>)}</ul> : <p className="text-sm text-ink-faint">No activity.</p>}</CardContent></Card>
  </div>;
}
function Row({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-ink-muted">{label}</span><span className="text-right font-medium text-ink">{value}</span></div>; }
