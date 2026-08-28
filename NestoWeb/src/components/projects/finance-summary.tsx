import Link from "next/link";
import { Wallet, TrendingUp, Receipt, PiggyBank } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { formatMinorWhole } from "@/lib/money";
import { getT } from "@/lib/i18n/server";

// Integer minor units throughout — see src/server/project-finance.ts.
type FinanceData = {
  budgetMinor: number | null;
  committedMinor: number;
  expensesMinor: number;
  invoicedMinor: number;
  remainingMinor: number;
};

export async function FinanceSummary({ data, canView }: { data: FinanceData; canView: boolean }) {
  const { t } = await getT();

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t("projectFinance.title")}</CardTitle>
          <CardDescription>{t("projectFinance.subtitle")}</CardDescription>
        </div>
        {canView && (
          <Link href="/dashboard/finance" className="text-xs text-ink-muted hover:text-ink whitespace-nowrap">
            {t("projectFinance.openFinanceModule")}
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {!canView ? (
          <p className="py-8 text-center text-sm text-ink-faint">{t("projects.restricted")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label={t("projectFinance.budget")} value={data.budgetMinor != null ? formatMinorWhole(data.budgetMinor) : "—"} icon={Wallet} />
            <StatTile label={t("projectFinance.committed")} value={formatMinorWhole(data.committedMinor)} icon={Receipt} iconColor="#C2540A" iconBg="#FBEAD9" />
            <StatTile label={t("projectFinance.invoiced")} value={formatMinorWhole(data.invoicedMinor)} icon={TrendingUp} iconColor="#1A7F4E" iconBg="#DEF3E7" />
            <StatTile
              label={t("projectFinance.remaining")}
              value={formatMinorWhole(data.remainingMinor)}
              icon={PiggyBank}
              iconColor={data.remainingMinor < 0 ? "#C0392B" : "#2457C5"}
              iconBg={data.remainingMinor < 0 ? "#FBE4E1" : "#E4ECFB"}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
