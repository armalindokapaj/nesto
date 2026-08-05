import Link from "next/link";
import { redirect } from "next/navigation";
import { Truck, PackageOpen, ClipboardList, Wallet, MessagesSquare, CalendarCheck2, AlertTriangle, ArrowUpRight } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getProcurementDashboardData } from "@/server/procurement";
import { getConfigResolver } from "@/server/platform-config";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";

export default async function ProcurementDashboardPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const config = await getConfigResolver(tenantId, company?.id);
  if (!config("procurement.page.dashboard")) redirect("/dashboard/executive");
  const data = await getProcurementDashboardData(tenantId);

  return <div className="space-y-6">
    <ProcurementPageHeader title="Procurement control center" description="Demand, sourcing, commitments, delivery exposure and supplier health in one traceable workspace." actions={<Link href="/dashboard/procurement/workspace" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-medium text-white">Open workspace <ArrowUpRight size={13} /></Link>} />
    <ProcurementNav active="overview" />

    {config("procurement.section.dashboard_kpis") && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile label="Open requests" value={String(data.openRequestsCount)} icon={ClipboardList} iconColor="#2457C5" iconBg="#E4ECFB" href="/dashboard/procurement/requests" />
      <StatTile label="Open RFQs" value={String(data.openRfqsCount)} icon={MessagesSquare} iconColor="#4a3aa7" iconBg="#EEEAFB" href="/dashboard/procurement/sourcing" />
      <StatTile label="Open purchase orders" value={String(data.openOrdersCount)} icon={PackageOpen} iconColor="#B76E00" iconBg="#FBECD2" href="/dashboard/procurement/orders" />
      <StatTile label="Committed value" value={formatCurrency(data.committedSpend)} icon={Wallet} iconColor="#1A7F4E" iconBg="#E2F4EA" />
    </div>}

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card><CardHeader><CardTitle>Demand and sourcing</CardTitle></CardHeader><CardContent className="space-y-4">
        <Metric label="Overdue requests" value={data.overdueRequestsCount} tone={data.overdueRequestsCount ? "danger" : "neutral"} />
        <Metric label="Supplier response rate" value={`${data.responseRate}%`} />
        <Metric label="Qualified suppliers" value={`${data.qualifiedSuppliers} / ${data.totalSuppliers}`} />
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Delivery control</CardTitle></CardHeader><CardContent className="space-y-4">
        <Metric label="Due in the next 7 days" value={data.dueDeliveriesCount} />
        <Metric label="Delayed or overdue" value={data.delayedDeliveriesCount} tone={data.delayedDeliveriesCount ? "danger" : "neutral"} />
        <Link href="/dashboard/procurement/deliveries" className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:underline">Open delivery schedule <ArrowUpRight size={12} /></Link>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Operational scope</CardTitle></CardHeader><CardContent className="space-y-3 text-xs text-ink-muted">
        <p className="flex gap-2"><Truck size={14} className="mt-0.5 shrink-0 text-gold" /> Procurement owns supplier purchasing context and commercial commitments.</p>
        <p className="flex gap-2"><CalendarCheck2 size={14} className="mt-0.5 shrink-0 text-gold" /> Inventory remains authoritative for posted goods receipts.</p>
        <p className="flex gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-gold" /> Finance, Contracts and Assets stay source-linked rather than duplicated.</p>
      </CardContent></Card>
    </div>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Recent demand</CardTitle><Link href="/dashboard/procurement/requests" className="text-xs text-gold">View all</Link></CardHeader><CardContent>
        {data.recentRequests.length ? <ul className="divide-y divide-border">{data.recentRequests.map((request) => <li key={request.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><Link href={`/dashboard/procurement/requests/${request.id}`} className="text-sm font-medium text-ink hover:text-gold">{request.number} · {request.title}</Link><p className="mt-0.5 truncate text-xs text-ink-muted">{request.project?.name ?? "Company-wide"} · required {request.requiredBy ? formatDate(request.requiredBy) : "not set"}</p></div><Badge status={request.status}>{request.status.replaceAll("_", " ")}</Badge></li>)}</ul> : <Empty text="No purchase requests yet." />}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Recent procurement activity</CardTitle></CardHeader><CardContent>
        {data.recentActivity.length ? <ul className="space-y-3">{data.recentActivity.map((event) => <li key={event.id} className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold" /><div><p className="text-sm text-ink">{event.summary}</p><p className="text-[0.7rem] text-ink-faint">{event.actor.displayName} · {formatDate(event.createdAt)}</p></div></li>)}</ul> : <Empty text="Activity will appear as procurement records move." />}
      </CardContent></Card>
    </div>
  </div>;
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "danger" }) {
  return <div className="flex items-center justify-between"><span className="text-sm text-ink-muted">{label}</span><span className={tone === "danger" ? "font-semibold text-danger" : "font-semibold text-ink"}>{value}</span></div>;
}

function Empty({ text }: { text: string }) { return <p className="py-6 text-center text-sm text-ink-faint">{text}</p>; }
