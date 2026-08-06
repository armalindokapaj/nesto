import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listSupplierDocuments } from "@/server/procurement";
import { getConfigResolver } from "@/server/platform-config";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { MarkRenewalRequiredButton } from "@/components/procurement/supplier-document-dialog-actions";

export default async function SupplierDocumentsPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const config = await getConfigResolver(tenantId, company?.id);
  if (!config("procurement.page.documents")) redirect("/dashboard/procurement/suppliers");
  const documents = await listSupplierDocuments(tenantId);
  const expiring = documents.filter((d) => ["EXPIRING_SOON", "EXPIRED", "RENEWAL_REQUIRED"].includes(d.status));
  const canWrite = can(role, "PROCUREMENT", "WRITE") && config("procurement.action.manage_documents");

  return <div className="space-y-6">
    <ProcurementPageHeader title="Supplier document renewal" description="Registration, insurance, tax and certification documents with expiry tracking, so a lapsed qualification never goes unnoticed." />
    <ProcurementNav active="documents" />
    {expiring.length > 0 && <Card><CardContent className="flex items-center gap-3 py-4"><ShieldAlert className="text-warning" size={20} /><p className="text-sm text-ink"><strong>{expiring.length}</strong> document(s) need attention: expiring within 30 days, already expired, or flagged for renewal.</p></CardContent></Card>}
    <Card><CardContent className="p-0"><Table><THead><TRow><TH>Supplier</TH><TH>Document</TH><TH>Type</TH><TH>Issued</TH><TH>Expires</TH><TH>Status</TH>{canWrite && <TH />}</TRow></THead><TBody>
      {documents.map((d) => <TRow key={d.id}><TD><Link href={`/dashboard/procurement/suppliers/${d.supplierId}`} className="font-medium text-ink hover:text-gold">{d.supplier.name}</Link></TD><TD className="text-ink-muted">{d.title}</TD><TD className="text-ink-muted">{d.type.replaceAll("_", " ")}</TD><TD className="text-ink-muted">{d.issuedAt ? formatDate(d.issuedAt) : "—"}</TD><TD className="text-ink-muted">{d.expiresAt ? formatDate(d.expiresAt) : "No expiry"}</TD><TD><Badge status={d.status}>{d.status.replaceAll("_", " ")}</Badge></TD>{canWrite && <TD>{d.status !== "RENEWAL_REQUIRED" && <MarkRenewalRequiredButton documentId={d.id} />}</TD>}</TRow>)}
      {!documents.length && <TRow><TD colSpan={canWrite ? 7 : 6} className="py-12 text-center text-ink-faint">No supplier documents recorded yet.</TD></TRow>}
    </TBody></Table></CardContent></Card>
  </div>;
}
