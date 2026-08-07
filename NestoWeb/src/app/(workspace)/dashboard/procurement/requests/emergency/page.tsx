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

export default async function EmergencyRequestsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const requests = (await listPurchaseRequests(tenantId)).filter((r) => r.type === "EMERGENCY_PURCHASE");

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Emergency requests" description="Requests using the configured emergency classification/override path. Every entry carries a reason and risk statement." />
      <ProcurementNav active="requests" />
      <Card><CardContent className="p-0"><Table><THead><TRow><TH>Request</TH><TH>Reason</TH><TH>Risk statement</TH><TH>Required by</TH><TH>Status</TH></TRow></THead><TBody>
        {requests.map((r) => <TRow key={r.id}><TD><Link href={`/dashboard/procurement/requests/${r.id}`} className="font-medium text-ink hover:text-gold">{r.title}</Link><p className="text-[0.68rem] text-ink-faint">{r.number}</p></TD><TD className="text-ink-muted max-w-xs truncate">{r.emergencyReason ?? "—"}</TD><TD className="text-ink-muted max-w-xs truncate">{r.riskStatement ?? "—"}</TD><TD className="text-ink-muted">{r.requiredBy ? formatDate(r.requiredBy) : "—"}</TD><TD><Badge status={r.status}>{r.status}</Badge></TD></TRow>)}
        {!requests.length && <TRow><TD colSpan={5} className="py-12 text-center text-ink-faint">No emergency requests.</TD></TRow>}
      </TBody></Table></CardContent></Card>
    </div>
  );
}
