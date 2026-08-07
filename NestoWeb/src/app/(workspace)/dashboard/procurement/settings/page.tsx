import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listSuppliers, listSupplierCategories, listProcurementPackages } from "@/server/procurement";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Card, CardContent } from "@/components/ui/card";

export default async function ProcurementSettingsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "FULL")) redirect("/dashboard/procurement");
  const [suppliers, categories, packages] = await Promise.all([listSuppliers(tenantId), listSupplierCategories(tenantId), listProcurementPackages(tenantId)]);

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Procurement Settings" description="Current master data. Module enable/disable and platform-wide rules live in Setup Center." />
      <ProcurementNav active="overview" />
      <Card><CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between border-b border-border/60 py-2"><span className="text-ink-muted">Suppliers</span><Link href="/dashboard/procurement/suppliers" className="font-semibold text-ink hover:text-gold">{suppliers.length}</Link></div>
        <div className="flex items-center justify-between border-b border-border/60 py-2"><span className="text-ink-muted">Supplier Categories</span><span className="font-semibold text-ink">{categories.length}</span></div>
        <div className="flex items-center justify-between border-b border-border/60 py-2"><span className="text-ink-muted">Procurement Packages</span><Link href="/dashboard/procurement/packages" className="font-semibold text-ink hover:text-gold">{packages.length}</Link></div>
        <div className="flex items-center justify-between py-2"><span className="text-ink-muted">Setup Center</span><Link href="/dashboard/admin/setup" className="font-semibold text-ink hover:text-gold">Open</Link></div>
      </CardContent></Card>
    </div>
  );
}
