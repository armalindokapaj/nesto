import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listFiscalPeriods, ensureCurrentFiscalPeriod } from "@/server/finance";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateFiscalPeriodDialog } from "@/components/finance/create-fiscal-period-dialog";
import { FiscalPeriodStatusSelect } from "@/components/finance/fiscal-period-status-select";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function FiscalPeriodsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "FINANCE", "FULL");

  // Idempotent — guarantees journal entry creation always has an open
  // period to post into, even before anyone has visited this page.
  await ensureCurrentFiscalPeriod(tenantId);
  const periods = await listFiscalPeriods(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("financeModule.fiscalPeriods")}</CardTitle>
            <CardDescription>{t("financeModule.fiscalPeriodsSubtitle")}</CardDescription>
          </div>
          {canManage && <CreateFiscalPeriodDialog />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("financeModule.periodName")}</TH>
                <TH>{t("financeModule.startDate")}</TH>
                <TH>{t("financeModule.endDate")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {periods.map((period) => (
                <TRow key={period.id}>
                  <TD className="font-medium text-ink">{period.name}</TD>
                  <TD className="text-ink-muted">{formatDate(period.startAt)}</TD>
                  <TD className="text-ink-muted">{formatDate(period.endAt)}</TD>
                  <TD>
                    {canManage ? (
                      <FiscalPeriodStatusSelect periodId={period.id} status={period.status} />
                    ) : (
                      <Badge tone={period.status === "OPEN" ? "success" : "neutral"}>{t(`financeModule.periodStatus_${period.status}`)}</Badge>
                    )}
                  </TD>
                </TRow>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
