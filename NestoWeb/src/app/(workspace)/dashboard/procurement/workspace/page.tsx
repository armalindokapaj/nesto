import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarDays, CircleDollarSign } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getProcurementWorkspace } from "@/server/procurement";
import { getConfigResolver } from "@/server/platform-config";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

const STAGES = ["Demand", "Sourcing", "Comparison", "Ready to order", "Ordered", "Delivery", "Completed"] as const;

export default async function ProcurementWorkspacePage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const config = await getConfigResolver(tenantId, company?.id);
  if (!config("procurement.page.workspace")) redirect("/dashboard/procurement");
  const data = await getProcurementWorkspace(tenantId);
  const cards = [
    ...data.requests.filter((r) => !["CLOSED", "CANCELLED", "REJECTED"].includes(r.status)).map((r) => ({ id: r.id, stage: r.status === "SOURCING" ? "Sourcing" : r.status.includes("ORDERED") ? "Ready to order" : "Demand", kind: "Request", code: r.number, title: r.title, status: r.status, project: r.project?.name, value: r.estimatedAmount, currency: r.currency, date: r.requiredBy, href: `/dashboard/procurement/requests/${r.id}` })),
    ...data.rfqs.filter((r) => !["CLOSED", "CANCELLED"].includes(r.status)).map((r) => ({ id: r.id, stage: ["EVALUATION", "NEGOTIATION", "RESPONSES_RECEIVED"].includes(r.status) ? "Comparison" : r.status === "AWARDED" ? "Ready to order" : "Sourcing", kind: "RFQ", code: r.number, title: r.title, status: r.status, project: r.project?.name, value: undefined, currency: "EUR", date: r.deadline, href: `/dashboard/procurement/sourcing/${r.id}` })),
    ...data.orders.filter((o) => !["CLOSED", "CANCELLED", "ARCHIVED"].includes(o.status)).map((o) => ({ id: o.id, stage: ["FULFILLED"].includes(o.status) ? "Completed" : ["PARTIALLY_FULFILLED"].includes(o.status) ? "Delivery" : "Ordered", kind: "Order", code: o.number, title: o.title ?? o.description, status: o.status, project: o.project?.name, value: o.amount, currency: o.currency, date: o.requestedDeliveryDate, href: `/dashboard/procurement/orders/${o.id}` })),
    ...data.deliveries.filter((d) => d.status !== "CLOSED").map((d) => ({ id: d.id, stage: ["ACCEPTED", "REJECTED"].includes(d.status) ? "Completed" : "Delivery", kind: "Delivery", code: d.number, title: `${d.supplier.name} · ${d.purchaseOrder.number}`, status: d.status, project: d.project?.name, value: undefined, currency: "EUR", date: d.expectedAt, href: "/dashboard/procurement/deliveries" })),
  ];
  const overdue = cards.filter((card) => card.date && card.date < new Date() && !["Completed"].includes(card.stage));

  return <div className="space-y-6">
    <ProcurementPageHeader title="Procurement workspace" description="A server-authoritative operating board from demand through fulfillment. Each card opens its source record." />
    <ProcurementNav active="workspace" />
    {overdue.length > 0 && <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning"><AlertTriangle size={16} /><strong>{overdue.length} overdue item{overdue.length === 1 ? "" : "s"}</strong><span className="text-ink-muted">need attention.</span></div>}
    <div className="overflow-x-auto pb-2"><div className="grid min-w-[1420px] grid-cols-7 gap-3">
      {STAGES.map((stage) => { const stageCards = cards.filter((card) => card.stage === stage); return <section key={stage} className="rounded-xl border border-border bg-surface-sunken/45 p-2.5"><div className="mb-3 flex items-center justify-between px-1"><h2 className="text-xs font-semibold text-ink">{stage}</h2><span className="rounded-full bg-surface px-2 py-0.5 text-[0.65rem] text-ink-muted">{stageCards.length}</span></div><div className="space-y-2">{stageCards.map((card) => <Link key={`${card.kind}-${card.id}`} href={card.href} className="block rounded-xl border border-border bg-surface p-3 shadow-[0_1px_2px_rgba(26,29,35,.04)] transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"><div className="flex items-start justify-between gap-2"><span className="text-[0.62rem] font-semibold uppercase tracking-wide text-gold">{card.kind}</span><Badge status={card.status}>{card.status.replaceAll("_", " ")}</Badge></div><p className="mt-2 text-xs font-semibold text-ink">{card.code}</p><p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{card.title}</p>{card.project && <p className="mt-2 truncate text-[0.68rem] text-ink-faint">{card.project}</p>}<div className="mt-2 space-y-1 border-t border-border pt-2">{card.value !== undefined && <p className="flex items-center gap-1 text-[0.68rem] font-medium text-ink"><CircleDollarSign size={11} /> {formatCurrency(card.value, card.currency)}</p>}{card.date && <p className={`flex items-center gap-1 text-[0.68rem] ${card.date < new Date() ? "text-danger" : "text-ink-faint"}`}><CalendarDays size={11} /> {formatDate(card.date)}</p>}</div></Link>)}{stageCards.length === 0 && <p className="rounded-lg border border-dashed border-border px-2 py-6 text-center text-[0.68rem] text-ink-faint">No records</p>}</div></section>; })}
    </div></div>
  </div>;
}
