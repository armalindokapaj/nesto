import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, CalendarDays, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listProcurementPackages, listPurchaseRequests, listRfqs, listSuppliers } from "@/server/procurement";
import { listProjects } from "@/server/projects";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { CreateRfqDialog } from "@/components/procurement/procurement-dialogs";
import { ProcurementStatusControl } from "@/components/procurement/procurement-status-control";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getConfigResolver } from "@/server/platform-config";

export default async function SourcingPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("procurement.page.sourcing")) redirect("/dashboard/procurement");
  const [rfqs, suppliers, projects, requests, packages] = await Promise.all([listRfqs(tenantId), listSuppliers(tenantId), listProjects(tenantId), listPurchaseRequests(tenantId), listProcurementPackages(tenantId)]);
  const canWrite = can(role, "PROCUREMENT", "WRITE");
  return <div className="space-y-6"><ProcurementPageHeader title="RFQs and sourcing" description="Issue controlled sourcing events, capture supplier offers and compare total evaluated cost with full traceability." actions={canWrite ? <CreateRfqDialog suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} projects={projects.map((p) => ({ id: p.id, name: p.name }))} requests={requests.map((r) => ({ id: r.id, number: r.number, title: r.title }))} packages={packages.map((p) => ({ id: p.id, number: p.number, name: p.name }))} /> : undefined} /><ProcurementNav active="sourcing" />
    <Card><CardContent className="p-0"><Table><THead><TRow><TH>Sourcing event</TH><TH>Context</TH><TH>Deadline</TH><TH>Suppliers</TH><TH>Responses</TH><TH>Status</TH><TH>Next action</TH><TH /></TRow></THead><TBody>{rfqs.map((rfq) => <TRow key={rfq.id}><TD><Link href={`/dashboard/procurement/sourcing/${rfq.id}`} className="font-medium text-ink hover:text-gold">{rfq.title}</Link><p className="text-[0.68rem] text-ink-faint">{rfq.number} · {rfq.type.replaceAll("_", " ")} · {rfq.lines.length} lines</p></TD><TD className="text-ink-muted">{rfq.project?.name ?? "Company-wide"}<p className="text-[0.68rem] text-ink-faint">{rfq.package?.number ?? "No package"}</p></TD><TD className={rfq.deadline && rfq.deadline < new Date() && !["CLOSED", "AWARDED"].includes(rfq.status) ? "text-danger" : "text-ink-muted"}>{rfq.deadline ? <span className="inline-flex items-center gap-1"><CalendarDays size={12} />{formatDate(rfq.deadline)}</span> : "—"}</TD><TD><span className="inline-flex items-center gap-1 text-sm text-ink-muted"><Users size={12} />{rfq.suppliers.length}</span></TD><TD className="font-medium text-ink">{rfq.quotations.length}</TD><TD><Badge status={rfq.status}>{rfq.status.replaceAll("_", " ")}</Badge></TD><TD>{canWrite && <ProcurementStatusControl entity="rfq" id={rfq.id} status={rfq.status} />}</TD><TD><Link href={`/dashboard/procurement/sourcing/${rfq.id}`} className="text-ink-faint hover:text-gold"><ArrowUpRight size={14} /></Link></TD></TRow>)}{!rfqs.length && <TRow><TD colSpan={8} className="py-12 text-center text-ink-faint">No sourcing events yet.</TD></TRow>}</TBody></Table></CardContent></Card>
  </div>;
}
