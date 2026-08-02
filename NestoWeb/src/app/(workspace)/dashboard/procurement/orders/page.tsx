import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listPurchaseOrders, listSuppliers } from "@/server/procurement";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreatePurchaseOrderDialog } from "@/components/procurement/create-purchase-order-dialog";
import { PurchaseOrderStatusSelect } from "@/components/procurement/purchase-order-status-select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ProcurementOrdersPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROCUREMENT", "WRITE");

  const [orders, suppliers, projects] = await Promise.all([
    listPurchaseOrders(tenantId),
    canWrite ? listSuppliers(tenantId) : Promise.resolve([]),
    canWrite ? listProjects(tenantId) : Promise.resolve([]),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("procurement_sub.ordersTitle")}</CardTitle>
            <CardDescription>{t("procurement_sub.ordersSubtitle")}</CardDescription>
          </div>
          {canWrite && (
            <CreatePurchaseOrderDialog
              suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
              projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("procurement_sub.number")}</TH>
                <TH>{t("procurement_sub.supplier")}</TH>
                <TH>{t("common.project")}</TH>
                <TH>{t("common.description")}</TH>
                <TH>{t("common.amount")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
              </TRow>
            </THead>
            <TBody>
              {orders.map((po) => (
                <TRow key={po.id}>
                  <TD className="font-medium text-ink">{po.number}</TD>
                  <TD className="text-ink-muted">{po.supplier.name}</TD>
                  <TD className="text-ink-muted">
                    {po.project ? (
                      <Link href={`/projects/${po.project.id}`} className="hover:text-gold hover:underline">
                        {po.project.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="text-ink-muted">{po.description}</TD>
                  <TD className="text-ink-muted">{formatCurrency(po.amount, po.currency)}</TD>
                  <TD>
                    {canWrite ? (
                      <PurchaseOrderStatusSelect orderId={po.id} status={po.status} />
                    ) : (
                      <Badge status={po.status}>{po.status}</Badge>
                    )}
                  </TD>
                  <TD className="text-ink-muted">{formatDate(po.createdAt)}</TD>
                </TRow>
              ))}
              {orders.length === 0 && (
                <TRow>
                  <TD colSpan={7} className="text-center text-ink-faint py-8">
                    {t("procurement_sub.noOrders")}
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
