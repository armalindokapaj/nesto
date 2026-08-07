import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function SupplierQualificationPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const qualifications = await db.supplierQualification.findMany({ where: { tenantId }, include: { supplier: true }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Supplier Qualification" description="Qualification outcomes, validity windows and expiring documents." />
      <ProcurementNav active="suppliers" />
      <Card><CardContent className="p-0"><Table><THead><TRow><TH>Supplier</TH><TH>Category</TH><TH>Outcome</TH><TH>Valid Until</TH></TRow></THead><TBody>
        {qualifications.map((q) => {
          const expiring = q.validUntil && q.validUntil < new Date(Date.now() + 30 * 86400000);
          return (
            <TRow key={q.id}>
              <TD className="font-medium text-ink"><Link href={`/dashboard/procurement/suppliers/${q.supplierId}`} className="hover:text-gold hover:underline">{q.supplier.name}</Link></TD>
              <TD className="text-ink-muted">{q.category ?? "—"}</TD>
              <TD><Badge status={q.outcome}>{q.outcome}</Badge></TD>
              <TD className={expiring ? "text-danger" : "text-ink-muted"}>{q.validUntil ? formatDate(q.validUntil) : "—"}</TD>
            </TRow>
          );
        })}
        {!qualifications.length && <TRow><TD colSpan={4} className="py-12 text-center text-ink-faint">No qualification records yet.</TD></TRow>}
      </TBody></Table></CardContent></Card>
    </div>
  );
}
