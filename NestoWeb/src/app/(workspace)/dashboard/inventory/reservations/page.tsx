import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listReservations } from "@/server/inventory-dashboard";
import { listProducts, listWarehouses } from "@/server/inventory-module";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateReservationDialog } from "@/components/inventory/create-reservation-dialog";
import { ReservationActions } from "@/components/inventory/reservation-actions";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ReservationsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROCUREMENT", "WRITE");

  const [reservations, products, warehouses, projects] = await Promise.all([
    listReservations(tenantId),
    listProducts(tenantId),
    listWarehouses(tenantId),
    listProjects(tenantId),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div><CardTitle>{t("inventoryModule.reservations")}</CardTitle><CardDescription>{t("inventoryModule.reservationsSubtitle")}</CardDescription></div>
          {canWrite && (
            <CreateReservationDialog
              products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name }))}
              warehouses={warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name }))}
              projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TRow><TH>{t("inventoryModule.product")}</TH><TH>{t("inventoryModule.warehouse")}</TH><TH>{t("inventoryModule.qty")}</TH><TH>{t("nav.projects")}</TH><TH>{t("common.status")}</TH><TH>{t("dashboards.admin.joined")}</TH><TH /></TRow></THead>
            <TBody>
              {reservations.map((r) => (
                <TRow key={r.id}>
                  <TD className="font-medium text-ink">{r.product.sku} — {r.product.name}</TD>
                  <TD className="text-ink-muted">{r.warehouse.code}</TD>
                  <TD className="text-ink">{r.qty}</TD>
                  <TD className="text-ink-muted">{r.project?.name ?? "—"}</TD>
                  <TD><Badge tone={r.status === "ACTIVE" ? "warning" : r.status === "FULFILLED" ? "success" : "neutral"}>{t(`inventoryModule.reservationStatus_${r.status}`)}</Badge></TD>
                  <TD className="text-ink-muted">{formatDate(r.createdAt)}</TD>
                  <TD>{canWrite && <ReservationActions id={r.id} status={r.status} />}</TD>
                </TRow>
              ))}
              {reservations.length === 0 && <TRow><TD colSpan={7} className="py-8 text-center text-ink-faint">{t("common.none")}</TD></TRow>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
