import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function QuotationsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const quotations = await db.supplierQuotation.findMany({ where: { tenantId }, include: { supplier: true, rfq: true }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Quotations" description="Supplier offers received against issued RFQs. Original and revised quotations remain linked." />
      <ProcurementNav active="sourcing" />
      <Card><CardContent className="p-0"><Table><THead><TRow><TH>Quotation</TH><TH>Supplier</TH><TH>RFQ</TH><TH>Total</TH><TH>Validity</TH><TH>Status</TH></TRow></THead><TBody>
        {quotations.map((q) => <TRow key={q.id}><TD className="font-medium text-ink">{q.number} {q.revision > 1 && <span className="text-ink-faint">rev.{q.revision}</span>}</TD><TD className="text-ink-muted">{q.supplier.name}</TD><TD className="text-ink-muted"><Link href={`/dashboard/procurement/sourcing/${q.rfqId}`} className="hover:text-gold hover:underline">{q.rfq.number}</Link></TD><TD className="font-medium text-ink">{formatCurrency(q.total, q.currency)}</TD><TD className="text-ink-muted">{q.validityDate ? formatDate(q.validityDate) : "—"}</TD><TD><Badge status={q.status}>{q.status}</Badge></TD></TRow>)}
        {!quotations.length && <TRow><TD colSpan={6} className="py-12 text-center text-ink-faint">No quotations received yet.</TD></TRow>}
      </TBody></Table></CardContent></Card>
    </div>
  );
}
