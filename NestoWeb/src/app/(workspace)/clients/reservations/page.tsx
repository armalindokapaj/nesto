import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listReservations, listUnitsDirectory } from "@/server/crm-module";
import { listClients } from "@/server/clients";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateReservationDialog } from "@/components/clients/create-reservation-dialog";
import { ReleaseReservationButton } from "@/components/clients/release-reservation-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// PRD_Sales_Dashboard §6/§12 — Reservations register. Unit availability
// stays owned by Unit; this reads ClientUnitRelationship (the CRM-owned
// join record) and lets Sales create/release reservations against it.
export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "CLIENTS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "CLIENTS", "WRITE");
  const params = await searchParams;

  const [reservations, clients, units] = await Promise.all([
    listReservations(tenantId),
    listClients(tenantId),
    listUnitsDirectory(tenantId),
  ]);
  const { t } = await getT();

  const availableUnits = units.filter((u) => u.lifecycleStatus === "AVAILABLE" || u.lifecycleStatus === "ON_HOLD");

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("clients.title")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("crm.reservationsTitle")}</CardTitle>
            <CardDescription>{t("crm.reservationsSubtitle")}</CardDescription>
          </div>
          {canWrite && (
            <CreateReservationDialog
              clients={clients.map((c) => ({ id: c.id, name: c.name }))}
              units={availableUnits.map((u) => ({ id: u.id, code: u.code, projectName: u.project.name }))}
              defaultOpen={params.open === "create"}
            />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("nav.clients")}</TH>
                <TH>{t("crm.unit")}</TH>
                <TH>{t("crm.reservationDate")}</TH>
                <TH>{t("crm.expirationDate")}</TH>
                <TH>{t("crm.depositAmount")}</TH>
                <TH>{t("crm.salesperson")}</TH>
                <TH>{t("common.status")}</TH>
                <TH></TH>
              </TRow>
            </THead>
            <TBody>
              {reservations.map((r) => (
                <TRow key={r.id}>
                  <TD className="font-medium text-ink">
                    <Link href={`/clients/${r.client.id}`} className="hover:text-gold hover:underline">
                      {r.client.name}
                    </Link>
                  </TD>
                  <TD className="text-ink-muted">
                    {r.unit.code} <span className="text-ink-faint">· {r.unit.project?.name}</span>
                  </TD>
                  <TD className="text-ink-muted whitespace-nowrap">{r.reservationDate ? formatDate(r.reservationDate) : "—"}</TD>
                  <TD className="text-ink-muted whitespace-nowrap">{r.expirationDate ? formatDate(r.expirationDate) : "—"}</TD>
                  <TD className="text-ink-muted">{r.depositAmount != null ? formatCurrency(r.depositAmount) : "—"}</TD>
                  <TD className="text-ink-muted">{r.salesperson?.displayName ?? "—"}</TD>
                  <TD>
                    <Badge tone={r.reservationStatus === "ACTIVE" ? "info" : r.reservationStatus === "CONVERTED" ? "success" : "neutral"}>
                      {t(`crm.reservationStatus_${r.reservationStatus ?? "ACTIVE"}`)}
                    </Badge>
                  </TD>
                  <TD>{canWrite && r.reservationStatus === "ACTIVE" && <ReleaseReservationButton relationshipId={r.id} />}</TD>
                </TRow>
              ))}
              {reservations.length === 0 && (
                <TRow>
                  <TD colSpan={8} className="py-8 text-center text-ink-faint">
                    {t("crm.noReservationsYet")}
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
