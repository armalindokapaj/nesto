import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getOrCreateTenantSettings } from "@/app/actions/tenant-settings";
import { Card, CardContent } from "@/components/ui/card";
import { TenantSettingsForm } from "@/components/settings/tenant-settings-form";
import { getT } from "@/lib/i18n/server";

export default async function FinanceSettingsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");

  const settings = await getOrCreateTenantSettings(tenantId);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("finance_sub.settingsTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("finance_sub.settingsSubtitle")}</p>
      </div>
      <Card>
        <CardContent>
          <TenantSettingsForm settings={settings} />
        </CardContent>
      </Card>
    </div>
  );
}
