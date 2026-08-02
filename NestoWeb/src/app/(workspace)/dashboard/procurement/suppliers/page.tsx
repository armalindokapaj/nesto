import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listSuppliers } from "@/server/procurement";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateSupplierDialog } from "@/components/procurement/create-supplier-dialog";
import { getT } from "@/lib/i18n/server";

export default async function ProcurementSuppliersPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const canCreate = can(role, "PROCUREMENT", "WRITE");

  const suppliers = await listSuppliers(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("procurement_sub.suppliersTitle")}</CardTitle>
            <CardDescription>{t("procurement_sub.suppliersSubtitle")}</CardDescription>
          </div>
          {canCreate && <CreateSupplierDialog />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("procurement_sub.number")}</TH>
                <TH>{t("common.name")}</TH>
                <TH>{t("procurement_sub.category")}</TH>
                <TH>{t("common.email")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {suppliers.map((s) => (
                <TRow key={s.id}>
                  <TD className="font-medium text-ink">{s.number}</TD>
                  <TD className="text-ink-muted">{s.name}</TD>
                  <TD className="text-ink-muted">{s.category}</TD>
                  <TD className="text-ink-muted">{s.email ?? "—"}</TD>
                  <TD>
                    <Badge status={s.status}>{t(`procurement_sub.${s.status.toLowerCase()}`)}</Badge>
                  </TD>
                </TRow>
              ))}
              {suppliers.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="text-center text-ink-faint py-8">
                    {t("procurement_sub.noSuppliers")}
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
