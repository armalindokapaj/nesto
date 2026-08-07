import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

// §18 Platform Configuration — module/page/section/widget toggles for
// Finance live in the platform-wide Setup Center (built for
// PRD_Platform_UI_UX_Architecture §20), not a second config surface here.
export default async function FinanceSettingsPage() {
  const { role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const canConfigure = can(role, "COMPANY_SETTINGS", "WRITE");
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.settingsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-muted">{t("dashboards.finance.financeModuleEnabled")}</p>
          {canConfigure && (
            <Link href="/dashboard/admin/setup">
              <Button size="sm">{t("nav.setupCenter")}</Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
