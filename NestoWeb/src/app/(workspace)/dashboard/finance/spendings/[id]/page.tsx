import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getSpendingBill } from "@/server/finance";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SpendingBillActions } from "@/components/finance/spending-bill-actions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function SpendingBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "FINANCE", "READ")) redirect("/dashboard/executive");
  const { id } = await params;
  const bill = await getSpendingBill(tenantId, id);
  const { t } = await getT();

  const activeStage = bill.workflowInstance?.stages.find((s) => s.status === "ACTIVE");
  const canDecide = !!activeStage && (activeStage.approverUserId ? activeStage.approverUserId === user.id : activeStage.approverRole === role) && bill.submitterId !== user.id;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/finance/spendings" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold">
        <ArrowLeft size={14} /> {t("dashboards.finance.spendingsWorkspaceTitle")}
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{bill.number}</CardTitle>
            <p className="text-sm text-ink-muted">{bill.category}</p>
          </div>
          <Badge status={bill.status}>{bill.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-ink-muted">{t("common.amount")}</p>
              <p className={bill.overBudget ? "text-danger font-medium" : "font-medium text-ink"}>{formatCurrency(bill.amount, bill.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t("nav.projects")}</p>
              <p className="font-medium text-ink">{bill.project?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t("common.supplier")}</p>
              <p className="font-medium text-ink">{bill.supplier?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">{t("dashboards.finance.submitter")}</p>
              <p className="font-medium text-ink">{bill.submitter.displayName}</p>
            </div>
          </div>

          {bill.evidenceDataUrl ? (
            <a href={bill.evidenceDataUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-gold hover:underline">
              {t("dashboards.finance.evidence")}
            </a>
          ) : (
            <p className="text-xs text-ink-faint">{bill.evidenceWaived ? t("dashboards.finance.evidenceWaive") : "—"}</p>
          )}

          {bill.status === "REJECTED" && bill.rejectionReason && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{bill.rejectionReason}</p>
          )}

          {bill.status === "PAID" && (
            <p className="text-xs text-ink-muted">
              {t("dashboards.finance.transferReference")}: {bill.transferReference} · {bill.paidAt ? formatDate(bill.paidAt) : "—"}
            </p>
          )}

          <SpendingBillActions billId={bill.id} status={bill.status} canDecide={canDecide} />

          <div>
            <p className="text-sm font-medium text-ink mb-2">{t("common.actions")}</p>
            <ul className="space-y-1.5 text-xs text-ink-muted">
              {bill.activity.map((a) => (
                <li key={a.id}>
                  {formatDate(a.createdAt)} — {a.summary} {a.actor && `(${a.actor.displayName})`}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
