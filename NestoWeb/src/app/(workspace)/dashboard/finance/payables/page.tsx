import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { InvoiceTypeTable } from "@/components/dashboards/invoice-type-table";
import { getT } from "@/lib/i18n/server";

// §6.1 "Payables ... AP aging / supplier invoices" — unpaid bills/expenses.
export default async function PayablesPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const rows = await db.invoice.findMany({
    where: { tenantId, type: { in: ["EXPENSE", "BILL"] }, status: { notIn: ["PAID", "COMPLETED"] } },
    orderBy: { dueDate: "asc" },
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.payablesTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <InvoiceTypeTable rows={rows} emptyKey="dashboards.finance.nothingDue" />
        </CardContent>
      </Card>
    </div>
  );
}
