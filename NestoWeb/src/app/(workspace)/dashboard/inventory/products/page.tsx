import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listProducts, listProductCategories, listUnitsOfMeasure } from "@/server/inventory-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateProductDialog } from "@/components/inventory/create-product-dialog";
import { CreateCategoryDialog } from "@/components/inventory/create-category-dialog";
import { CreateUomDialog } from "@/components/inventory/create-uom-dialog";
import { getT } from "@/lib/i18n/server";

export default async function ProductsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROCUREMENT", "WRITE");

  const [products, categories, units] = await Promise.all([listProducts(tenantId), listProductCategories(tenantId), listUnitsOfMeasure(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("inventoryModule.products")}</CardTitle>
            <CardDescription>{t("inventoryModule.productsSubtitle")}</CardDescription>
          </div>
          {canWrite && <CreateProductDialog categories={categories.map((c) => ({ id: c.id, name: c.name }))} units={units.map((u) => ({ id: u.id, symbol: u.symbol }))} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("inventoryModule.sku")}</TH>
                <TH>{t("common.name")}</TH>
                <TH>{t("inventoryModule.category")}</TH>
                <TH>{t("inventoryModule.baseUnit")}</TH>
                <TH>{t("inventoryModule.trackingType")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {products.map((product) => (
                <TRow key={product.id}>
                  <TD className="font-mono text-xs font-medium text-ink">
                    <Link href={`/dashboard/inventory/products/${product.id}`} className="hover:text-gold hover:underline">
                      {product.sku}
                    </Link>
                  </TD>
                  <TD className="text-ink">{product.name}</TD>
                  <TD className="text-ink-muted">{product.category?.name ?? "—"}</TD>
                  <TD className="text-ink-muted">{product.baseUom?.symbol ?? "—"}</TD>
                  <TD className="text-ink-muted">{product.trackingType}</TD>
                  <TD>
                    <Badge status={product.status}>{product.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {products.length === 0 && (
                <TRow>
                  <TD colSpan={6} className="py-8 text-center text-ink-faint">
                    {t("inventoryModule.noProducts")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("inventoryModule.categories")}</CardTitle>
            {canWrite && <CreateCategoryDialog />}
          </CardHeader>
          <CardContent className="space-y-1.5">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">{c.name}</span>
                <span className="font-mono text-xs text-ink-faint">{c.code}</span>
              </div>
            ))}
            {categories.length === 0 && <p className="text-xs text-ink-faint">{t("common.none")}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("inventoryModule.unitsOfMeasure")}</CardTitle>
            {canWrite && <CreateUomDialog />}
          </CardHeader>
          <CardContent className="space-y-1.5">
            {units.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">{u.name}</span>
                <span className="font-mono text-xs text-ink-faint">{u.symbol}</span>
              </div>
            ))}
            {units.length === 0 && <p className="text-xs text-ink-faint">{t("common.none")}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
