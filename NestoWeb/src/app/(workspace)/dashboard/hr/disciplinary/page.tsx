import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";

// §Disciplinary & Grievances — no DisciplinaryCase model exists yet; honest
// scope note rather than a fabricated case list. HR/FULL only, since this
// leaf is the most sensitive of the whole module even before real data
// exists.
export default async function DisciplinaryPage() {
  const { role } = await getCurrentUser();
  if (!can(role, "HR", "FULL")) redirect("/dashboard/hr");
  const { t } = await getT();

  return (
    <Card>
      <CardHeader><div><CardTitle>{t("nav.disciplinaryAndGrievances")}</CardTitle><CardDescription>{t("hrDashboard.notYetBuilt")}</CardDescription></div></CardHeader>
      <CardContent className="py-8 text-center text-sm text-ink-faint">{t("hrDashboard.disciplinaryEmptyState")}</CardContent>
    </Card>
  );
}
