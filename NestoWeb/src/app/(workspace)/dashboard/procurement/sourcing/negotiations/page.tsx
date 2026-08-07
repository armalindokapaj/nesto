import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

// §10.2 "Negotiation rounds preserve history" — a negotiation round is a
// revised SupplierQuotation (revision > 1) against the same RFQ/supplier;
// there is no separate NegotiationRound model, this reads the existing
// revision history rather than inventing a parallel one.
export default async function NegotiationsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const revised = await db.supplierQuotation.findMany({ where: { tenantId, revision: { gt: 1 } }, include: { supplier: true, rfq: true }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Negotiations" description="Quotation revisions raised during negotiation rounds. Every revision preserves the prior offer." />
      <ProcurementNav active="sourcing" />
      <Card><CardContent className="p-0"><Table><THead><TRow><TH>Quotation</TH><TH>Supplier</TH><TH>RFQ</TH><TH>Round</TH><TH>Total</TH></TRow></THead><TBody>
        {revised.map((q) => <TRow key={q.id}><TD className="font-medium text-ink">{q.number}</TD><TD className="text-ink-muted">{q.supplier.name}</TD><TD className="text-ink-muted"><Link href={`/dashboard/procurement/sourcing/${q.rfqId}`} className="hover:text-gold hover:underline">{q.rfq.number}</Link></TD><TD className="text-ink-muted">Round {q.revision}</TD><TD className="font-medium text-ink">{formatCurrency(q.total, q.currency)}</TD></TRow>)}
        {!revised.length && <TRow><TD colSpan={5} className="py-12 text-center text-ink-faint">No negotiation rounds yet — quotations only appear here once a revised offer is recorded.</TD></TRow>}
      </TBody></Table></CardContent></Card>
    </div>
  );
}
