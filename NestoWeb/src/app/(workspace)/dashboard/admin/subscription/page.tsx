import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listAllMembers } from "@/server/admin";
import { listModuleStates } from "@/server/company-modules";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { UpdatePlanForm } from "@/components/admin/update-plan-form";
import { ModuleToggleList } from "@/components/admin/module-toggle-list";
import { getT } from "@/lib/i18n/server";

export default async function AdminSubscriptionPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "READ")) redirect("/dashboard/executive");
  const canManage = can(role, "COMPANY_SETTINGS", "FULL");

  const members = await listAllMembers(tenantId);
  const moduleStates = canManage ? await listModuleStates(tenantId) : [];
  const { t } = await getT();

  const seatsUsed = members.length;
  const seatLimit = company?.seatLimit ?? 0;
  const usagePct = seatLimit > 0 ? Math.min(100, Math.round((seatsUsed / seatLimit) * 100)) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("admin_sub.subscriptionTitle")}</CardTitle>
            <CardDescription>{t("admin_sub.subscriptionSubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-surface-sunken p-4">
              <p className="text-xs text-ink-muted">{t("admin_sub.currentPlan")}</p>
              <p className="text-2xl font-semibold text-ink mt-1">{company?.planName ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-sunken p-4">
              <p className="text-xs text-ink-muted">{t("admin_sub.seatsUsed")}</p>
              <p className="text-2xl font-semibold text-ink mt-1">
                {seatsUsed} / {seatLimit}
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-border overflow-hidden">
                <div className="h-full bg-gold" style={{ width: `${usagePct}%` }} />
              </div>
            </div>
          </div>

          {canManage && company && <UpdatePlanForm planName={company.planName} />}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("admin_sub.modulesTitle")}</CardTitle>
              <CardDescription>{t("admin_sub.modulesSubtitle")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ModuleToggleList states={moduleStates} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
