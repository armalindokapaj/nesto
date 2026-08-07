import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { listProducts, listWarehouses } from "@/server/inventory-module";
import { listAllMembers } from "@/server/admin";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MovementForm } from "@/components/inventory/movement-form";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function GoodsIssuesPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROCUREMENT", "WRITE");

  const [movements, products, warehouses, members, projects] = await Promise.all([
    db.inventoryMovement.findMany({
      where: { tenantId, type: { in: ["ISSUE", "ADJUSTMENT_DECREASE"] } },
      orderBy: { date: "desc" },
      include: { createdBy: { select: { displayName: true } }, recipient: { select: { displayName: true } } },
    }),
    listProducts(tenantId),
    listWarehouses(tenantId),
    listAllMembers(tenantId),
    listProjects(tenantId),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      {canWrite && (
        <Card>
          <CardHeader><div><CardTitle>{t("inventoryModule.newGoodsIssue")}</CardTitle><CardDescription>{t("inventoryModule.taggedIssueSubtitle")}</CardDescription></div></CardHeader>
          <CardContent>
            {products.length > 0 && warehouses.length > 0 ? (
              <MovementForm
                products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))}
                warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
                allowedTypes={["ISSUE"]}
                showRecipient
                showProject
                recipients={members.map((m) => ({ id: m.user.id, displayName: m.user.displayName }))}
                projects={projects.map((p) => ({ id: p.id, name: p.name }))}
                redirectTo="/dashboard/inventory/issues"
              />
            ) : (
              <p className="text-sm text-ink-faint">{t("inventoryModule.needProductsAndWarehouse")}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{t("nav.goodsIssues")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("financeModule.journalNumber")}</TH><TH>{t("inventoryModule.recipient")}</TH><TH>{t("common.status")}</TH><TH>{t("inventoryModule.confirmationStatus")}</TH><TH>{t("dashboards.admin.joined")}</TH></TRow></THead>
            <TBody>
              {movements.map((m) => (
                <TRow key={m.id}>
                  <TD className="font-mono text-xs font-medium text-ink"><Link href={`/dashboard/inventory/movements/${m.id}`} className="hover:text-gold hover:underline">{m.number}</Link></TD>
                  <TD className="text-ink-muted">{m.recipient?.displayName ?? "—"}</TD>
                  <TD><Badge tone={m.status === "POSTED" ? "success" : m.status === "REVERSED" ? "neutral" : "warning"}>{t(`inventoryModule.movementStatus_${m.status}`)}</Badge></TD>
                  <TD>
                    {m.confirmationStatus !== "NOT_REQUIRED" && (
                      <Badge tone={m.confirmationStatus === "CONFIRMED" ? "success" : m.confirmationStatus === "DISPUTED" ? "danger" : "warning"}>
                        {t(`inventoryModule.confirmationStatus_${m.confirmationStatus}`)}
                      </Badge>
                    )}
                  </TD>
                  <TD className="text-ink-muted">{formatDate(m.date)}</TD>
                </TRow>
              ))}
              {movements.length === 0 && <TRow><TD colSpan={5} className="py-8 text-center text-ink-faint">{t("inventoryModule.noMovements")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
