import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getCountDetail } from "@/server/inventory-dashboard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CountDetailActions } from "@/components/inventory/count-detail-actions";
import { getT } from "@/lib/i18n/server";

export default async function CountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROCUREMENT", "WRITE");
  const canApprove = can(role, "PROCUREMENT", "FULL");

  const count = await getCountDetail(tenantId, id);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Link href="/dashboard/inventory/counts" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("inventoryModule.counts")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>{count.warehouse.name}</CardTitle>
              <Badge tone={count.status === "APPROVED" ? "success" : count.status === "CANCELLED" ? "neutral" : "warning"}>{t(`inventoryModule.countStatus_${count.status}`)}</Badge>
            </div>
            <CardDescription>{t(`inventoryModule.countType${count.type === "CYCLE" ? "Cycle" : "Physical"}`)} {count.blind && `· ${t("inventoryModule.blindCount")}`}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {canWrite && (
            <CountDetailActions
              countId={count.id}
              status={count.status}
              canApprove={canApprove}
              lines={count.lines.map((l) => ({ id: l.id, productSku: l.product.sku, productName: l.product.name, systemQty: l.systemQty, countedQty: l.countedQty }))}
            />
          )}
          <Table>
            <THead><TRow><TH>{t("inventoryModule.product")}</TH><TH className="text-right">{t("inventoryModule.systemQty")}</TH><TH className="text-right">{t("inventoryModule.countedQty")}</TH><TH className="text-right">{t("inventoryModule.variance")}</TH></TRow></THead>
            <TBody>
              {count.lines.map((line) => (
                <TRow key={line.id}>
                  <TD className="text-ink">{line.product.sku} — {line.product.name}</TD>
                  <TD className="text-right text-ink-muted">{line.systemQty}</TD>
                  <TD className="text-right text-ink">{line.countedQty ?? "—"}</TD>
                  <TD className="text-right text-ink-muted">{line.countedQty !== null ? (line.countedQty - line.systemQty).toFixed(2) : "—"}</TD>
                </TRow>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
