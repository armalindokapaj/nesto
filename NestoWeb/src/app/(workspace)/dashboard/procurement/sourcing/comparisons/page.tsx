import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listComparisons } from "@/server/procurement-comparison";
import { listRfqs } from "@/server/procurement";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { CreateComparisonDialog } from "@/components/procurement/create-comparison-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function ComparisonsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROCUREMENT", "WRITE");
  const [comparisons, rfqs] = await Promise.all([listComparisons(tenantId), listRfqs(tenantId)]);

  return (
    <div className="space-y-6">
      <ProcurementPageHeader
        title="Supplier Comparison"
        description="Score every received quotation on price, lead time, compliance, quality, HSE, warranty, performance and risk."
        actions={canWrite ? <CreateComparisonDialog rfqs={rfqs.map((r) => ({ id: r.id, number: r.number, title: r.title, quotationCount: r.quotations.length }))} /> : undefined}
      />
      <ProcurementNav active="sourcing" />
      <Card><CardContent className="p-0"><Table><THead><TRow><TH>Comparison</TH><TH>RFQ</TH><TH>Quotations Scored</TH><TH>Status</TH><TH>Award</TH></TRow></THead><TBody>
        {comparisons.map((c) => (
          <TRow key={c.id}>
            <TD className="font-medium text-ink"><Link href={`/dashboard/procurement/sourcing/comparisons/${c.id}`} className="hover:text-gold hover:underline">{c.number}</Link></TD>
            <TD className="text-ink-muted">{c.rfq.number} — {c.rfq.title}</TD>
            <TD className="text-ink-muted">{c.scores.length} score(s)</TD>
            <TD><Badge status={c.status}>{c.status}</Badge></TD>
            <TD className="text-ink-muted">{c.awards[0] ? <Badge status={c.awards[0].status}>{c.awards[0].status}</Badge> : "—"}</TD>
          </TRow>
        ))}
        {!comparisons.length && <TRow><TD colSpan={5} className="py-12 text-center text-ink-faint">No comparisons started yet.</TD></TRow>}
      </TBody></Table></CardContent></Card>
    </div>
  );
}
