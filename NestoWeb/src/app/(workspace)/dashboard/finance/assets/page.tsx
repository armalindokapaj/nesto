import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listAssets } from "@/server/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateAssetDialog } from "@/components/finance/create-asset-dialog";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function AssetsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const canCreate = can(role, "FINANCE", "WRITE");

  const assets = await listAssets(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("finance_sub.assetsTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("finance_sub.assetsSubtitle")}</p>
        </div>
        {canCreate && <CreateAssetDialog />}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.name")}</TH>
                <TH>{t("common.type")}</TH>
                <TH>{t("common.project")}</TH>
                <TH>{t("finance_sub.purchaseValue")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {assets.map((asset) => (
                <TRow key={asset.id}>
                  <TD className="font-medium text-ink">{asset.name}</TD>
                  <TD className="text-ink-muted">{asset.type}</TD>
                  <TD className="text-ink-muted">
                    {asset.project ? (
                      <Link href={`/projects/${asset.project.id}`} className="hover:text-gold hover:underline">
                        {asset.project.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="text-ink-muted">{asset.purchaseValue ? formatCurrency(asset.purchaseValue) : "—"}</TD>
                  <TD>
                    <Badge status={asset.status}>{asset.status.replace("_", " ")}</Badge>
                  </TD>
                </TRow>
              ))}
              {assets.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="text-center text-ink-faint py-8">
                    {t("finance_sub.noAssets")}
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
