import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, MessagesSquare, PackageOpen, Truck, ShieldAlert, Inbox, ArrowUpRight } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getProcurementDashboard } from "@/server/procurement-dashboard";
import { getConfigResolver } from "@/server/platform-config";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { formatMinorWhole } from "@/lib/money";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";

// PRD_Procurement_Dashboard §4/§5/§6 — the exact six Primary Cues (Open
// Purchase Requests, Open RFQs, Open Purchase Orders, Deliveries At Risk,
// Supplier Exceptions, My Pending Actions) plus My Work, Pipeline, Demand &
// Sourcing, Orders & Delivery, Supplier Health, Commercial Summary, Upcoming
// and Recent Activity.
export default async function ProcurementDashboardPage() {
  const { tenantId, role, company, user } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const config = await getConfigResolver(tenantId, company?.id);
  if (!config("procurement.page.dashboard")) redirect("/dashboard/executive");
  const data = await getProcurementDashboard(tenantId, user.id);

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Procurement control center" description="Demand, sourcing, commitments, delivery exposure and supplier health in one traceable workspace." actions={<Link href="/dashboard/procurement/workspace" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-medium text-white">Open workspace <ArrowUpRight size={13} /></Link>} />
      <ProcurementNav active="overview" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Open Purchase Requests" value={String(data.cues.openPurchaseRequests)} icon={ClipboardList} iconColor="#2457C5" iconBg="#E4ECFB" href="/dashboard/procurement/requests" />
        <StatTile label="Open RFQs" value={String(data.cues.openRfqs)} icon={MessagesSquare} iconColor="#4a3aa7" iconBg="#EEEAFB" href="/dashboard/procurement/sourcing" />
        <StatTile label="Open Purchase Orders" value={String(data.cues.openPurchaseOrders)} icon={PackageOpen} iconColor="#B76E00" iconBg="#FBECD2" href="/dashboard/procurement/orders" />
        <StatTile label="Deliveries At Risk" value={String(data.cues.deliveriesAtRisk)} icon={Truck} iconColor="#C0392B" iconBg="#FBE4E1" href="/dashboard/procurement/deliveries" />
        <StatTile label="Supplier Exceptions" value={String(data.cues.supplierExceptions)} icon={ShieldAlert} iconColor="#C0392B" iconBg="#FBE4E1" href="/dashboard/procurement/suppliers/performance" />
        <StatTile label="My Pending Actions" value={String(data.cues.myPendingActions)} icon={Inbox} iconColor="#1A7F4E" iconBg="#E2F4EA" href="/dashboard/procurement/my-work" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Procurement Pipeline</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <Metric label="Demand" value={data.pipeline.demand} />
          <Metric label="Sourcing" value={data.pipeline.sourcing} />
          <Metric label="Ready to Order" value={data.pipeline.readyToOrder} />
          <Metric label="Ordered" value={data.pipeline.ordered} />
          <Metric label="Delivery" value={data.pipeline.delivery} />
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Demand & Sourcing</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <Metric label="Overdue Requests" value={data.demandAndSourcing.overdueRequests} tone={data.demandAndSourcing.overdueRequests ? "danger" : "neutral"} />
          <Metric label="Emergency Requests" value={data.demandAndSourcing.emergencyRequests} />
          <Metric label="Open RFQs" value={data.demandAndSourcing.openRfqs} />
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Orders & Delivery</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <Metric label="Committed Value" value={formatMinorWhole(data.ordersAndDelivery.committedValueMinor)} />
          <Metric label="Unacknowledged POs" value={data.ordersAndDelivery.unacknowledgedOrders} />
          <Metric label="Due This Week" value={data.ordersAndDelivery.dueThisWeek} />
          <Metric label="Delayed" value={data.ordersAndDelivery.delayed} tone={data.ordersAndDelivery.delayed ? "danger" : "neutral"} />
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Supplier Health</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <Metric label="Qualified" value={`${data.supplierHealth.qualified} / ${data.supplierHealth.total}`} />
          <Metric label="Suspended" value={data.supplierHealth.suspended} tone={data.supplierHealth.suspended ? "danger" : "neutral"} />
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Commercial Summary</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <Metric label="Requested" value={formatMinorWhole(data.commercialSummary.requestedMinor)} />
          <Metric label="Committed" value={formatMinorWhole(data.commercialSummary.committedMinor)} />
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Upcoming</CardTitle></CardHeader><CardContent>
          {data.upcoming.length ? <ul className="space-y-2">{data.upcoming.map((d) => <li key={d.id} className="flex items-center justify-between text-sm"><span className="text-ink">{d.supplier.name}</span><span className="text-ink-muted">{d.expectedAt ? formatDate(d.expectedAt) : "—"}</span></li>)}</ul> : <Empty text="Nothing scheduled." />}
        </CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>Recent Procurement Activity</CardTitle></CardHeader><CardContent>
        {data.recentActivity.length ? <ul className="space-y-3">{data.recentActivity.map((event) => <li key={event.id} className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold" /><div><p className="text-sm text-ink">{event.summary}</p><p className="text-[0.7rem] text-ink-faint">{event.actor?.displayName} · {formatDate(event.createdAt)}</p></div></li>)}</ul> : <Empty text="Activity will appear as procurement records move." />}
      </CardContent></Card>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "danger" }) {
  return <div className="flex items-center justify-between"><span className="text-ink-muted">{label}</span><span className={tone === "danger" ? "font-semibold text-danger" : "font-semibold text-ink"}>{value}</span></div>;
}
function Empty({ text }: { text: string }) { return <p className="py-6 text-center text-sm text-ink-faint">{text}</p>; }
