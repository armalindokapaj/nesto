import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";
import { formatCurrency } from "@/lib/utils";

// §2 "Out of scope: Live bank feeds, payment gateways or external ERP
// integrations" — this v1 page is honestly manual: it shows account
// balances only, with no bank-statement import or auto-match, and says so.
export default async function BankReconciliationPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const accounts = await db.financeAccount.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.reconciliationTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-ink-faint">{t("dashboards.finance.reconciliationNotice")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {accounts.map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium text-ink">{a.name}</p>
                <p className="text-xs text-ink-muted">{formatCurrency(a.balance, a.currency)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
