import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listSpendingBills, listMySpendingReviewItems } from "@/server/finance-spendings";
import { listProjects } from "@/server/projects";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateSpendingBillDialog } from "@/components/finance/create-spending-bill-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

// PRD_Finance_Dashboard §11.1 — the nine Spendings page views, each a query
// param on this one route (not nine separate pages) so filters/deep links
// compose cleanly (§16 "dashboard drill-down must preserve ... scope").
const VIEWS = [
  { key: "all", labelKey: "dashboards.finance.viewAllSpendings" },
  { key: "my-review", labelKey: "dashboards.finance.viewMyReview" },
  { key: "pending-superior", labelKey: "dashboards.finance.viewPendingSuperior", status: "PENDING_SUPERIOR" },
  { key: "pending-finance", labelKey: "dashboards.finance.viewPendingFinance", status: "PENDING_FINANCE" },
  { key: "approved", labelKey: "dashboards.finance.viewApprovedForPayment", status: "APPROVED_FOR_PAYMENT" },
  { key: "paid", labelKey: "dashboards.finance.viewPaid", status: "PAID" },
  { key: "rejected", labelKey: "dashboards.finance.viewRejected", status: "REJECTED" },
  { key: "drafts", labelKey: "dashboards.finance.viewDrafts", status: "DRAFT" },
  { key: "over-budget", labelKey: "dashboards.finance.viewOverBudget" },
] as const;

export default async function SpendingsPage({ searchParams }: { searchParams: Promise<{ view?: string; open?: string }> }) {
  const { tenantId, role, user, company } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "FINANCE", "WRITE");
  const params = await searchParams;
  const view = VIEWS.find((v) => v.key === params.view) ?? VIEWS[0];

  const [bills, projects] = await Promise.all([
    view.key === "my-review"
      ? listMySpendingReviewItems(tenantId, user.id, role)
      : view.key === "over-budget"
        ? listSpendingBills(tenantId, undefined, { overBudget: true })
        : listSpendingBills(tenantId, undefined, "status" in view ? { status: view.status } : undefined),
    listProjects(tenantId),
  ]);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1.5">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/dashboard/finance/spendings?view=${v.key}`}
            className={
              v.key === view.key
                ? "inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs font-medium text-canvas"
                : "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
            }
          >
            {t(v.labelKey)}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("dashboards.finance.spendingsWorkspaceTitle")}</CardTitle>
            <CardDescription>{t("dashboards.finance.spendingsSubtitle")}</CardDescription>
          </div>
          {canWrite && company && (
            <CreateSpendingBillDialog
              companyId={company.id}
              projects={projects.map((p) => ({ id: p.id, name: p.name }))}
              defaultOpen={params.open === "create"}
            />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("common.date")}</TH>
                <TH>{t("common.category")}</TH>
                <TH>{t("nav.projects")}</TH>
                <TH>{t("common.amount")}</TH>
                <TH>{t("dashboards.finance.submitter")}</TH>
                <TH>{t("common.status")}</TH>
              </TRow>
            </THead>
            <TBody>
              {bills.map((b) => (
                <TRow key={b.id}>
                  <TD className="text-ink-muted whitespace-nowrap">{formatDate(b.createdAt)}</TD>
                  <TD>
                    <Link href={`/dashboard/finance/spendings/${b.id}`} className="font-medium text-ink hover:text-gold hover:underline">
                      {b.number}
                    </Link>
                    <p className="text-xs text-ink-muted">{b.category}</p>
                  </TD>
                  <TD className="text-ink-muted">{b.project?.name ?? "—"}</TD>
                  <TD className={b.overBudget ? "text-danger font-medium" : "text-ink-muted"}>{formatCurrency(b.amount, b.currency)}</TD>
                  <TD className="text-ink-muted">{b.submitter.displayName}</TD>
                  <TD>
                    <Badge status={b.status}>{t(`dashboards.finance.status${toPascal(b.status)}`)}</Badge>
                  </TD>
                </TRow>
              ))}
              {bills.length === 0 && (
                <TRow>
                  <TD colSpan={6} className="py-8 text-center text-ink-faint">
                    {t("dashboards.finance.noSpendingBills")}
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

function toPascal(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((s) => s[0]?.toUpperCase() + s.slice(1))
    .join("");
}
