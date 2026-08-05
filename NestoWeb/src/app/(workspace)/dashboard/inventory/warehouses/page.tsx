import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listWarehouses } from "@/server/inventory-module";
import { listAllMembers } from "@/server/admin";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateWarehouseDialog } from "@/components/inventory/create-warehouse-dialog";
import { getT } from "@/lib/i18n/server";

export default async function WarehousesPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "PROCUREMENT", "FULL");

  const [warehouses, members] = await Promise.all([listWarehouses(tenantId), listAllMembers(tenantId)]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("inventoryModule.warehouses")}</CardTitle>
            <CardDescription>{t("inventoryModule.warehousesSubtitle")}</CardDescription>
          </div>
          {canManage && <CreateWarehouseDialog members={members.map((m) => ({ id: m.user.id, displayName: m.user.displayName }))} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("inventoryModule.code")}</TH>
                <TH>{t("common.name")}</TH>
                <TH>{t("inventoryModule.address")}</TH>
                <TH>{t("inventoryModule.manager")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {warehouses.map((w) => (
                <TRow key={w.id}>
                  <TD className="font-mono text-xs font-medium text-ink">{w.code}</TD>
                  <TD className="text-ink">{w.name}</TD>
                  <TD className="text-ink-muted">{w.address ?? "—"}</TD>
                  <TD className="text-ink-muted">{w.manager?.displayName ?? "—"}</TD>
                  <TD>
                    <Badge status={w.status}>{w.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {warehouses.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="py-8 text-center text-ink-faint">
                    {t("inventoryModule.noWarehouses")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
