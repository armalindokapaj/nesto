import Link from "next/link";
import { Wallet, TrendingUp, Receipt, PiggyBank } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

type FinanceData = {
  budget: number | null;
  committed: number;
  expenses: number;
  invoiced: number;
  remaining: number;
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
            <StatTile label={t("projectFinance.budget")} value={data.budget != null ? formatCurrency(data.budget) : "—"} icon={Wallet} />
            <StatTile label={t("projectFinance.committed")} value={formatCurrency(data.committed)} icon={Receipt} iconColor="#C2540A" iconBg="#FBEAD9" />
            <StatTile label={t("projectFinance.invoiced")} value={formatCurrency(data.invoiced)} icon={TrendingUp} iconColor="#1A7F4E" iconBg="#DEF3E7" />
            <StatTile
              label={t("projectFinance.remaining")}
              value={formatCurrency(data.remaining)}
              icon={PiggyBank}
              iconColor={data.remaining < 0 ? "#C0392B" : "#2457C5"}
              iconBg={data.remaining < 0 ? "#FBE4E1" : "#E4ECFB"}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
