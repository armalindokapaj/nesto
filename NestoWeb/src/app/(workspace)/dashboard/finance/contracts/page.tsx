import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getT } from "@/lib/i18n/server";
import { formatMinor } from "@/lib/money";

export default async function ContractFinancePage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const contracts = await db.contract.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { project: { select: { id: true, name: true } } },
  });
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboards.finance.contractFinanceTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.description")}</TH>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("dashboards.finance.budget")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {contracts.map((c) => (
                <TRow key={c.id}>
                  <TD>
                    <Link href={`/contracts/${c.id}`} className="font-medium text-ink hover:text-gold hover:underline">
                      {c.number}
                    </Link>
                    <p className="text-xs text-ink-muted">{c.title}</p>
                  </TD>
                  <TD className="text-ink-muted">{c.project?.name ?? "—"}</TD>
                  <TD className="text-ink-muted">{formatMinor(c.valueMinor, c.currency)}</TD>
                  <TD>
                    <Badge status={c.status}>{c.status}</Badge>
                  </TD>
                </TRow>
              ))}
              {contracts.length === 0 && (
                <TRow>
                  <TD colSpan={4} className="py-8 text-center text-ink-faint">
                    —
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
