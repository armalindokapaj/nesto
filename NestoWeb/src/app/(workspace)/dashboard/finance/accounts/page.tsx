import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listAccounts, listCostCenters } from "@/server/finance";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateAccountDialog } from "@/components/finance/create-account-dialog";
import { CreateCostCenterDialog } from "@/components/finance/create-cost-center-dialog";
import { getT } from "@/lib/i18n/server";

export default async function ChartOfAccountsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "FINANCE", "FULL");

  const [accounts, costCenters] = await Promise.all([listAccounts(tenantId), listCostCenters(tenantId)]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("financeModule.chartOfAccounts")}</CardTitle>
            <CardDescription>{t("financeModule.chartOfAccountsSubtitle")}</CardDescription>
          </div>
          {canManage && <CreateAccountDialog accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("financeModule.accountCode")}</TH>
                <TH>{t("common.name")}</TH>
                <TH>{t("financeModule.accountType")}</TH>
                <TH>{t("financeModule.normalBalance")}</TH>
                <TH>{t("financeModule.parentAccount")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {accounts.map((account) => (
                <TRow key={account.id}>
                  <TD className="font-mono text-xs font-medium text-ink">{account.code}</TD>
                  <TD className="text-ink">{account.name}</TD>
                  <TD>
                    <Badge tone="neutral">{account.type}</Badge>
                  </TD>
                  <TD className="text-ink-muted">{account.normalBalance}</TD>
                  <TD className="text-ink-muted">{account.parentId ? accountById.get(account.parentId)?.name : "—"}</TD>
                  <TD>
                    <Badge status={account.status}>{account.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {accounts.length === 0 && (
                <TRow>
                  <TD colSpan={6} className="py-8 text-center text-ink-faint">
                    {t("financeModule.noAccounts")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-sm">{t("financeModule.costCenters")}</CardTitle>
          </div>
          {canManage && <CreateCostCenterDialog />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("financeModule.accountCode")}</TH>
                <TH>{t("common.name")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {costCenters.map((cc) => (
                <TRow key={cc.id}>
                  <TD className="font-mono text-xs font-medium text-ink">{cc.code}</TD>
                  <TD className="text-ink">{cc.name}</TD>
                  <TD>
                    <Badge status={cc.status}>{cc.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {costCenters.length === 0 && (
                <TRow>
                  <TD colSpan={3} className="py-6 text-center text-ink-faint">
                    {t("financeModule.noCostCenters")}
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
