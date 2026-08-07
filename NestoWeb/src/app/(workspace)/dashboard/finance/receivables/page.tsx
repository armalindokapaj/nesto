import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { InvoiceTypeTable } from "@/components/dashboards/invoice-type-table";
import { getT } from "@/lib/i18n/server";

// §6.1 "Receivables ... AR aging / invoices" — unpaid sales invoices.
export default async function ReceivablesPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const rows = await db.invoice.findMany({
    where: { tenantId, type: "INVOICE", status: { notIn: ["PAID", "COMPLETED"] } },
    orderBy: { dueDate: "asc" },
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.receivablesTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <InvoiceTypeTable rows={rows} emptyKey="dashboards.finance.nothingDue" />
        </CardContent>
      </Card>
    </div>
  );
}
