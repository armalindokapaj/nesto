import { redirect } from "next/navigation";
import { Boxes, CalendarDays, CircleDollarSign } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listProcurementPackages } from "@/server/procurement";
import { listProjects } from "@/server/projects";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { CreatePackageDialog } from "@/components/procurement/procurement-dialogs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getConfigResolver } from "@/server/platform-config";

export default async function ProcurementPackagesPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("procurement.page.packages")) redirect("/dashboard/procurement");
  const [packages, projects] = await Promise.all([listProcurementPackages(tenantId), listProjects(tenantId)]);
  return <div className="space-y-6"><ProcurementPageHeader title="Procurement packages" description="Coordinate related demand, scope, sourcing, orders and delivery around one commercial outcome." actions={can(role, "PROCUREMENT", "WRITE") ? <CreatePackageDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} /> : undefined} /><ProcurementNav active="packages" />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{packages.map((pkg) => <Card key={pkg.id} className="transition hover:-translate-y-0.5 hover:shadow-md"><CardContent className="pt-5"><div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-soft text-gold"><Boxes size={17} /></div><Badge status={pkg.status}>{pkg.status}</Badge></div><p className="mt-4 text-xs font-semibold text-gold">{pkg.number}</p><h2 className="mt-1 text-base font-semibold text-ink">{pkg.name}</h2><p className="mt-1 line-clamp-2 min-h-8 text-xs text-ink-muted">{pkg.scope ?? "Scope is being defined."}</p><div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-surface-sunken p-2 text-center"><Mini label="Requests" value={pkg._count.requests} /><Mini label="RFQs" value={pkg._count.rfqs} /><Mini label="Orders" value={pkg._count.purchaseOrders} /></div><div className="mt-4 space-y-2 text-xs text-ink-muted"><p>{pkg.project?.name ?? "Company-wide"}</p><p className="flex items-center gap-1"><CircleDollarSign size={12} /> Target {formatCurrency(pkg.targetValue, pkg.currency)}</p>{pkg.awardTarget && <p className="flex items-center gap-1"><CalendarDays size={12} /> Award target {formatDate(pkg.awardTarget)}</p>}</div></CardContent></Card>)}{!packages.length && <div className="col-span-full rounded-xl border border-dashed border-border py-16 text-center text-sm text-ink-faint">No coordinated procurement packages yet.</div>}</div>
  </div>;
}
function Mini({ label, value }: { label: string; value: number }) { return <div><p className="font-semibold text-ink">{value}</p><p className="text-[0.62rem] text-ink-faint">{label}</p></div>; }
