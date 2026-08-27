import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getAwardDetail } from "@/server/procurement-comparison";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AwardDecisionActions } from "@/components/procurement/award-decision-actions";
import { CreatePoFromAwardButton } from "@/components/procurement/create-po-from-award-button";
import { formatDate } from "@/lib/utils";
import { formatMinor } from "@/lib/money";

export default async function AwardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const canApprove = can(role, "PROCUREMENT", "FULL");

  const award = await getAwardDetail(tenantId, id);
  const isPreparer = award.preparedById === user.id;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/procurement/sourcing/awards" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold"><ArrowLeft size={14} /> Award Recommendations</Link>

      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2"><CardTitle>{award.number}</CardTitle><Badge status={award.status}>{award.status}</Badge></div>
            <CardDescription>{award.rfq.title} — recommending {award.recommendedSupplier.name}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-ink-muted">Recommended value</span><span className="font-medium text-ink">{formatMinor(award.recommendedQuotation.totalMinor, award.recommendedQuotation.currency)}</span></div>
          <div className="flex justify-between"><span className="text-ink-muted">Prepared by</span><span className="text-ink">{award.preparedBy.displayName} · {formatDate(award.preparedAt)}</span></div>
          {award.decidedBy && <div className="flex justify-between"><span className="text-ink-muted">Decided by</span><span className="text-ink">{award.decidedBy.displayName} · {award.decidedAt && formatDate(award.decidedAt)}</span></div>}
          {award.justification && <p className="text-ink-muted">{award.justification}</p>}
          {award.decisionNote && <p className="rounded-lg bg-surface-sunken p-2 text-ink-muted">{award.decisionNote}</p>}
        </CardContent>
      </Card>

      {award.status === "SUBMITTED" && canApprove && (
        isPreparer ? (
          <p className="text-xs text-ink-faint">You prepared this recommendation and cannot also decide it (separation of duties).</p>
        ) : (
          <AwardDecisionActions id={award.id} />
        )
      )}

      {award.status === "APPROVED" && (
        award.purchaseOrders.length > 0 ? (
          <p className="text-sm text-ink-muted">Converted to <Link href={`/dashboard/procurement/orders/${award.purchaseOrders[0]!.id}`} className="text-gold hover:underline">{award.purchaseOrders[0]!.number}</Link></p>
        ) : (
          can(role, "PROCUREMENT", "WRITE") && <CreatePoFromAwardButton awardId={award.id} />
        )
      )}
    </div>
  );
}
