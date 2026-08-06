import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Star } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listSupplierCategories, listSuppliers } from "@/server/procurement";
import { getConfigResolver } from "@/server/platform-config";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateSupplierDialog } from "@/components/procurement/create-supplier-dialog";
import { SupplierCategoryDialog } from "@/components/procurement/supplier-category-dialog";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";

export default async function ProcurementSuppliersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const config = await getConfigResolver(tenantId, company?.id);
  if (!config("procurement.page.suppliers")) redirect("/dashboard/procurement");
  const { q = "", status = "" } = await searchParams;
  const [allSuppliers, categories] = await Promise.all([listSuppliers(tenantId), listSupplierCategories(tenantId)]);
  const suppliers = allSuppliers.filter((s) => (!q || `${s.number} ${s.name} ${s.category}`.toLowerCase().includes(q.toLowerCase())) && (!status || s.status === status));
  const canCreate = can(role, "PROCUREMENT", "WRITE") && config("procurement.action.create_supplier");
  const canManageCategories = can(role, "PROCUREMENT", "WRITE") && config("procurement.action.manage_categories");

  return <div className="space-y-6">
    <ProcurementPageHeader title="Supplier directory" description="Qualification, commercial context, sourcing participation, risk and performance without duplicating legal or Finance records." actions={<div className="flex gap-2">{canManageCategories && <SupplierCategoryDialog categories={categories} />}{canCreate && <CreateSupplierDialog categories={categories.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))} />}</div>} />
    <ProcurementNav active="suppliers" />
    <form className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-3"><input name="q" defaultValue={q} placeholder="Search code, supplier or category…" className="h-9 min-w-64 flex-1 rounded-lg border border-border bg-surface px-3 text-sm" /><select name="status" defaultValue={status} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm"><option value="">All statuses</option>{["PROSPECT", "UNDER_QUALIFICATION", "QUALIFIED", "PREFERRED", "SUSPENDED", "BLACKLISTED"].map((value) => <option key={value}>{value}</option>)}</select><button className="h-9 rounded-lg bg-ink px-4 text-xs font-medium text-white">Apply</button></form>
    <Card><CardContent className="p-0"><Table><THead><TRow><TH>Supplier</TH><TH>Category</TH><TH>Qualification</TH><TH>Score</TH><TH>Commercial activity</TH><TH>Risk</TH><TH>Status</TH><TH /></TRow></THead><TBody>
      {suppliers.map((supplier) => <TRow key={supplier.id}><TD><Link href={`/dashboard/procurement/suppliers/${supplier.id}`} className="font-medium text-ink hover:text-gold">{supplier.name}</Link><p className="text-[0.68rem] text-ink-faint">{supplier.number} · {supplier.supplierType.replaceAll("_", " ")}</p></TD><TD className="text-ink-muted">{supplier.category}</TD><TD className="text-ink-muted">{supplier.qualificationStatus.replaceAll("_", " ")}</TD><TD>{supplier.overallScore !== null ? <span className="inline-flex items-center gap-1 text-sm font-medium text-ink"><Star size={12} className="fill-gold text-gold" />{supplier.overallScore.toFixed(0)}</span> : "—"}</TD><TD className="text-ink-muted">{supplier._count.quotations} quotes · {supplier._count.purchaseOrders} POs</TD><TD>{supplier._count.riskFlags ? <span className="inline-flex items-center gap-1 text-xs text-warning"><AlertTriangle size={12} />{supplier._count.riskFlags}</span> : <span className="text-xs text-ink-faint">Clear</span>}</TD><TD><Badge status={supplier.status}>{supplier.status.replaceAll("_", " ")}</Badge></TD><TD><Link href={`/dashboard/procurement/suppliers/${supplier.id}`} aria-label={`Open ${supplier.name}`} className="text-ink-faint hover:text-gold"><ArrowUpRight size={14} /></Link></TD></TRow>)}
      {!suppliers.length && <TRow><TD colSpan={8} className="py-12 text-center text-ink-faint">No suppliers match this view.</TD></TRow>}
    </TBody></Table></CardContent></Card>
  </div>;
}
