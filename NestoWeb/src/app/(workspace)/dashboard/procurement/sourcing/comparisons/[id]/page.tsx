import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getComparisonDetail } from "@/server/procurement-comparison";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ComparisonScoreGrid } from "@/components/procurement/comparison-score-grid";
import { RecommendAwardForm } from "@/components/procurement/recommend-award-form";

export default async function ComparisonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROCUREMENT", "WRITE");
  const canApprove = can(role, "PROCUREMENT", "FULL");

  const comparison = await getComparisonDetail(tenantId, id);
  const quotations = comparison.rfq.quotations;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/procurement/sourcing/comparisons" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-gold"><ArrowLeft size={14} /> Supplier Comparison</Link>

      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2"><CardTitle>{comparison.number}</CardTitle><Badge status={comparison.status}>{comparison.status}</Badge></div>
            <CardDescription>{comparison.rfq.number} — {comparison.rfq.title}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {quotations.length > 0 ? (
            <ComparisonScoreGrid
              comparisonId={comparison.id}
              status={comparison.status}
              canComplete={canWrite}
              quotations={quotations.map((q) => ({ id: q.id, supplierId: q.supplierId, supplierName: q.supplier.name, totalMinor: q.totalMinor, currency: q.currency, leadTimeDays: q.leadTimeDays }))}
              existingScores={comparison.scores.map((s) => ({ quotationId: s.quotationId, criterion: s.criterion, score: s.score }))}
            />
          ) : (
            <p className="py-8 text-center text-sm text-ink-faint">This RFQ has no quotations.</p>
          )}
        </CardContent>
      </Card>

      {comparison.status === "COMPLETED" && canWrite && comparison.awards.length === 0 && (
        <RecommendAwardForm comparisonId={comparison.id} quotations={quotations.map((q) => ({ id: q.id, supplierName: q.supplier.name, totalMinor: q.totalMinor, currency: q.currency }))} />
      )}

      {comparison.awards.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Award Recommendations</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {comparison.awards.map((a) => (
              <Link key={a.id} href={`/dashboard/procurement/sourcing/awards/${a.id}`} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:border-gold">
                <span className="text-ink">{a.recommendedSupplier.name}</span>
                <Badge status={a.status}>{a.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
      {!canApprove && <p className="text-xs text-ink-faint">Award decisions require FULL Procurement authority.</p>}
    </div>
  );
}
