import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function SupplierPerformanceRiskPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const [suppliers, riskFlags] = await Promise.all([
    db.supplier.findMany({ where: { tenantId, archivedAt: null, overallScore: { not: null } }, orderBy: { overallScore: "desc" } }),
    db.supplierRiskFlag.findMany({ where: { tenantId, status: "OPEN" }, include: { supplier: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Performance & Risk" description="Governed supplier performance ranking with visible methodology, plus open risk flags." />
      <ProcurementNav active="suppliers" />

      <Card><CardContent className="p-0"><Table><THead><TRow><TH>Supplier</TH><TH>Status</TH><TH className="text-right">Score</TH></TRow></THead><TBody>
        {suppliers.map((s) => <TRow key={s.id}><TD className="font-medium text-ink"><Link href={`/dashboard/procurement/suppliers/${s.id}`} className="hover:text-gold hover:underline">{s.name}</Link></TD><TD><Badge status={s.status}>{s.status}</Badge></TD><TD className="text-right text-ink">{s.overallScore}</TD></TRow>)}
        {!suppliers.length && <TRow><TD colSpan={3} className="py-12 text-center text-ink-faint">No supplier performance scores recorded yet.</TD></TRow>}
      </TBody></Table></CardContent></Card>

      <Card><CardContent className="p-0"><Table><THead><TRow><TH>Supplier</TH><TH>Risk Type</TH><TH>Severity</TH><TH>Summary</TH></TRow></THead><TBody>
        {riskFlags.map((r) => <TRow key={r.id}><TD className="font-medium text-ink"><Link href={`/dashboard/procurement/suppliers/${r.supplierId}`} className="hover:text-gold hover:underline">{r.supplier.name}</Link></TD><TD className="text-ink-muted">{r.type}</TD><TD><Badge tone={r.severity === "HIGH" || r.severity === "CRITICAL" ? "danger" : "warning"}>{r.severity}</Badge></TD><TD className="text-ink-muted max-w-xs truncate">{r.summary}</TD></TRow>)}
        {!riskFlags.length && <TRow><TD colSpan={4} className="py-12 text-center text-ink-faint">No open risk flags.</TD></TRow>}
      </TBody></Table></CardContent></Card>
    </div>
  );
}
