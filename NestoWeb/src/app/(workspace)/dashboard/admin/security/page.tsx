import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { getT } from "@/lib/i18n/server";

export default async function AdminSecurityPage() {
  const { role } = await getCurrentUser();
  if (!can(role, "USER_MANAGEMENT", "READ")) redirect("/dashboard/executive");

  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("admin_sub.securityTitle")}</CardTitle>
            <CardDescription>{t("admin_sub.securitySubtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("help.security")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink-muted">
            <li>{t("admin_sub.securityPoint1")}</li>
            <li>{t("admin_sub.securityPoint2")}</li>
            <li>{t("admin_sub.securityPoint3")}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
