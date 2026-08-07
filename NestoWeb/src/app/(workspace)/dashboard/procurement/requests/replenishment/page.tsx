import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listPurchaseRequests } from "@/server/procurement";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function ReplenishmentRequestsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  // "Replenishment" maps to the existing STOCK_ITEM request type — the
  // create-request form has no separate REPLENISHMENT type, and this project
  // does not invent a new one just for this nav label.
  const requests = (await listPurchaseRequests(tenantId)).filter((r) => r.type === "STOCK_ITEM");

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Replenishment requests" description="Stock-item purchase demand originating from reorder/replenishment triggers." />
      <ProcurementNav active="requests" />
      <Card><CardContent className="p-0"><Table><THead><TRow><TH>Request</TH><TH>Context</TH><TH>Required by</TH><TH>Status</TH></TRow></THead><TBody>
        {requests.map((r) => <TRow key={r.id}><TD><Link href={`/dashboard/procurement/requests/${r.id}`} className="font-medium text-ink hover:text-gold">{r.title}</Link><p className="text-[0.68rem] text-ink-faint">{r.number}</p></TD><TD className="text-ink-muted">{r.project?.name ?? "Company-wide"}</TD><TD className="text-ink-muted">{r.requiredBy ? formatDate(r.requiredBy) : "—"}</TD><TD><Badge status={r.status}>{r.status}</Badge></TD></TRow>)}
        {!requests.length && <TRow><TD colSpan={4} className="py-12 text-center text-ink-faint">No replenishment requests. Requests raised with type REPLENISHMENT will appear here.</TD></TRow>}
      </TBody></Table></CardContent></Card>
    </div>
  );
}
