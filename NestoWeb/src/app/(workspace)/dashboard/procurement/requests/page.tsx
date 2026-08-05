import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listPurchaseRequests } from "@/server/procurement";
import { listProjects } from "@/server/projects";
import { getConfigResolver } from "@/server/platform-config";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { CreatePurchaseRequestDialog } from "@/components/procurement/procurement-dialogs";
import { ProcurementStatusControl } from "@/components/procurement/procurement-status-control";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function PurchaseRequestsPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const config = await getConfigResolver(tenantId, company?.id);
  if (!config("procurement.page.requests")) redirect("/dashboard/procurement");
  const [requests, projects] = await Promise.all([listPurchaseRequests(tenantId), listProjects(tenantId)]);
  const canWrite = can(role, "PROCUREMENT", "WRITE");
  const now = new Date();
  return <div className="space-y-6">
    <ProcurementPageHeader title="Purchase requests" description="Capture project, stock, asset, service, subcontract and company demand before commercial commitment." actions={canWrite && config("procurement.action.create_request") ? <CreatePurchaseRequestDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} /> : undefined} />
    <ProcurementNav active="requests" />
    <div className="grid gap-3 sm:grid-cols-4"><Summary label="Open demand" value={requests.filter((r) => !["CLOSED", "REJECTED", "CANCELLED"].includes(r.status)).length} /><Summary label="Emergency" value={requests.filter((r) => r.type === "EMERGENCY_PURCHASE").length} /><Summary label="Overdue" value={requests.filter((r) => r.requiredBy && r.requiredBy < now && !["CLOSED", "CANCELLED"].includes(r.status)).length} /><Summary label="Estimated demand" value={formatCurrency(requests.filter((r) => !["CANCELLED", "REJECTED"].includes(r.status)).reduce((s, r) => s + r.estimatedAmount, 0))} /></div>
    <Card><CardContent className="p-0"><Table><THead><TRow><TH>Request</TH><TH>Context</TH><TH>Type</TH><TH>Required by</TH><TH>Estimate</TH><TH>Status</TH><TH>Next action</TH><TH /></TRow></THead><TBody>{requests.map((request) => { const overdue = request.requiredBy && request.requiredBy < now && !["CLOSED", "CANCELLED"].includes(request.status); return <TRow key={request.id}><TD><Link href={`/dashboard/procurement/requests/${request.id}`} className="font-medium text-ink hover:text-gold">{request.title}</Link><p className="text-[0.68rem] text-ink-faint">{request.number} · {request.lines.length} line{request.lines.length === 1 ? "" : "s"}</p></TD><TD className="text-ink-muted">{request.project?.name ?? "Company-wide"}<p className="text-[0.68rem] text-ink-faint">{request.createdBy.displayName}</p></TD><TD className="text-ink-muted">{request.type.replaceAll("_", " ")}</TD><TD className={overdue ? "text-danger" : "text-ink-muted"}>{overdue && <AlertTriangle size={12} className="mr-1 inline" />}{request.requiredBy ? formatDate(request.requiredBy) : "—"}</TD><TD className="font-medium text-ink">{formatCurrency(request.estimatedAmount, request.currency)}</TD><TD><Badge status={request.status}>{request.status.replaceAll("_", " ")}</Badge></TD><TD>{canWrite && <ProcurementStatusControl entity="request" id={request.id} status={request.status} />}</TD><TD><Link href={`/dashboard/procurement/requests/${request.id}`} className="text-ink-faint hover:text-gold"><ArrowUpRight size={14} /></Link></TD></TRow>; })}{!requests.length && <TRow><TD colSpan={8} className="py-12 text-center text-ink-faint">No purchase demand has been recorded.</TD></TRow>}</TBody></Table></CardContent></Card>
  </div>;
}
function Summary({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-border bg-surface p-4"><p className="text-[0.68rem] uppercase tracking-wide text-ink-faint">{label}</p><p className="mt-1 text-xl font-semibold text-ink">{value}</p></div>; }
