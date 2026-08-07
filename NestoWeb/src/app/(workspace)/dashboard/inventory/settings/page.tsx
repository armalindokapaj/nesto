import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listWarehouses, listProducts } from "@/server/inventory-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";

// §Settings — Inventory has no per-tenant config table of its own yet
// (unlike Finance/HR's dedicated settings models); this page is an honest,
// real summary of the module's current master data plus a link into
// Platform Configuration where module enable/disable already lives, rather
// than a fabricated preferences form with nothing behind it.
export default async function InventorySettingsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "FULL")) redirect("/dashboard/inventory");

  const [warehouses, products] = await Promise.all([listWarehouses(tenantId), listProducts(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>{t("nav.inventorySettings")}</CardTitle><CardDescription>{t("inventoryModule.settingsSubtitle")}</CardDescription></div></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-border/60 py-2">
            <span className="text-ink-muted">{t("inventoryModule.warehouses")}</span>
            <Link href="/dashboard/inventory/warehouses" className="font-semibold text-ink hover:text-gold">{warehouses.length}</Link>
          </div>
          <div className="flex items-center justify-between border-b border-border/60 py-2">
            <span className="text-ink-muted">{t("inventoryModule.products")}</span>
            <Link href="/dashboard/inventory/products" className="font-semibold text-ink hover:text-gold">{products.length}</Link>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-ink-muted">{t("nav.setupCenter")}</span>
            <Link href="/dashboard/admin/setup" className="font-semibold text-ink hover:text-gold">{t("common.open")}</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
