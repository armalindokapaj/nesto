import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getMovementDetail } from "@/server/inventory-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { MovementActions } from "@/components/inventory/movement-actions";
import { MovementConfirmActions } from "@/components/inventory/movement-confirm-actions";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function MovementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "PROCUREMENT", "FULL");

  const movement = await getMovementDetail(tenantId, id);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/inventory/movements" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("inventoryModule.movements")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="font-mono text-base">{movement.number}</CardTitle>
              <Badge tone={movement.status === "POSTED" ? "success" : movement.status === "REVERSED" ? "neutral" : "warning"}>
                {t(`inventoryModule.movementStatus_${movement.status}`)}
              </Badge>
            </div>
            <CardDescription>
              {t(`inventoryModule.movementType_${movement.type}`)} · {formatDate(movement.date)}
              {movement.reason && ` · ${movement.reason}`}
              {movement.reversesMovement && (
                <>
                  {" · "}
                  {t("financeModule.reversalOf")}{" "}
                  <Link href={`/dashboard/inventory/movements/${movement.reversesMovement.id}`} className="hover:text-gold hover:underline">
                    {movement.reversesMovement.number}
                  </Link>
                </>
              )}
              {movement.reversedBy && (
                <>
                  {" · "}
                  {t("financeModule.reversedBy")}{" "}
                  <Link href={`/dashboard/inventory/movements/${movement.reversedBy.id}`} className="hover:text-gold hover:underline">
                    {movement.reversedBy.number}
                  </Link>
                </>
              )}
              {movement.recipient && ` · ${t("inventoryModule.recipient")}: ${movement.recipient.displayName}`}
              {movement.project && ` · ${movement.project.name}`}
            </CardDescription>
            {movement.confirmationStatus !== "NOT_REQUIRED" && (
              <div className="mt-2 flex items-center gap-2">
                <Badge tone={movement.confirmationStatus === "CONFIRMED" ? "success" : movement.confirmationStatus === "DISPUTED" ? "danger" : "warning"}>
                  {t(`inventoryModule.confirmationStatus_${movement.confirmationStatus}`)}
                </Badge>
                {movement.disputeReason && <span className="text-xs text-danger">{movement.disputeReason}</span>}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {canManage && <MovementActions movementId={movement.id} status={movement.status} />}
            <MovementConfirmActions movementId={movement.id} confirmationStatus={movement.confirmationStatus} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("inventoryModule.sku")}</TH>
                <TH>{t("inventoryModule.fromWarehouse")}</TH>
                <TH>{t("inventoryModule.toWarehouse")}</TH>
                <TH className="text-right">{t("inventoryModule.qty")}</TH>
              </TRow>
            </THead>
            <TBody>
              {movement.lines.map((line) => (
                <TRow key={line.id}>
                  <TD className="text-ink">
                    <span className="font-mono text-xs">{line.product.sku}</span> {line.product.name}
                  </TD>
                  <TD className="text-ink-muted">{line.fromWarehouse?.name ?? "—"}</TD>
                  <TD className="text-ink-muted">{line.toWarehouse?.name ?? "—"}</TD>
                  <TD className="text-right text-ink-muted">
                    {line.qty} {line.uom?.symbol ?? ""}
                  </TD>
                </TRow>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {movement.activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("documents.activity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5 text-xs text-ink-muted">
              {movement.activity.map((event) => (
                <li key={event.id} className="flex items-start gap-2">
                  {event.actor && <Avatar name={event.actor.displayName} color={event.actor.avatarColor ?? undefined} size={20} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-ink">{event.summary}</p>
                    <p className="text-ink-faint">{formatDate(event.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
