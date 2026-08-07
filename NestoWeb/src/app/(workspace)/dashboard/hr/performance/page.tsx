import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";

// §Performance — no PerformanceReview model exists yet; honest scope note.
export default async function PerformancePage() {
  const { role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  const { t } = await getT();

  return (
    <Card>
      <CardHeader><div><CardTitle>{t("nav.performance")}</CardTitle><CardDescription>{t("hrDashboard.notYetBuilt")}</CardDescription></div></CardHeader>
      <CardContent className="py-8 text-center text-sm text-ink-faint">{t("hrDashboard.performanceEmptyState")}</CardContent>
    </Card>
  );
}
