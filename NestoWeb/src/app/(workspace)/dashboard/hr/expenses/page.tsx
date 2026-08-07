import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";

// §Expenses & Reimbursements — no Expense/Reimbursement model exists yet in
// either HR or Finance; an honest scope note rather than a fabricated form,
// same treatment as "Recruitment pipeline is Phase 2" got earlier.
export default async function ExpensesPage() {
  const { role } = await getCurrentUser();
  if (!can(role, "HR", "READ")) redirect("/dashboard/executive");
  const { t } = await getT();

  return (
    <Card>
      <CardHeader><div><CardTitle>{t("nav.expensesAndReimbursements")}</CardTitle><CardDescription>{t("hrDashboard.notYetBuilt")}</CardDescription></div></CardHeader>
      <CardContent className="py-8 text-center text-sm text-ink-faint">{t("hrDashboard.expensesEmptyState")}</CardContent>
    </Card>
  );
}
