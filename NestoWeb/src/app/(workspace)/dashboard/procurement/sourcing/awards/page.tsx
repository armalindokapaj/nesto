import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listAwardRecommendations } from "@/server/procurement-comparison";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function AwardRecommendationsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const awards = await listAwardRecommendations(tenantId);

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Award Recommendations" description="Award preparation is not sole approval — the preparer of a recommendation cannot also decide it." />
      <ProcurementNav active="sourcing" />
      <Card><CardContent className="p-0"><Table><THead><TRow><TH>Award</TH><TH>Supplier</TH><TH>Prepared By</TH><TH>Decided By</TH><TH>Status</TH></TRow></THead><TBody>
        {awards.map((a) => (
          <TRow key={a.id}>
            <TD className="font-medium text-ink"><Link href={`/dashboard/procurement/sourcing/awards/${a.id}`} className="hover:text-gold hover:underline">{a.number}</Link></TD>
            <TD className="text-ink-muted">{a.recommendedSupplier.name}</TD>
            <TD className="text-ink-muted">{a.preparedBy.displayName} · {formatDate(a.preparedAt)}</TD>
            <TD className="text-ink-muted">{a.decidedBy?.displayName ?? "—"}</TD>
            <TD><Badge status={a.status}>{a.status}</Badge></TD>
          </TRow>
        ))}
        {!awards.length && <TRow><TD colSpan={5} className="py-12 text-center text-ink-faint">No award recommendations yet.</TD></TRow>}
      </TBody></Table></CardContent></Card>
    </div>
  );
}
