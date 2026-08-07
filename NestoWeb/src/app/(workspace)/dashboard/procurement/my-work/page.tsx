import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listAwardRecommendations, listComparisons } from "@/server/procurement-comparison";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ProcurementMyWorkPage() {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");

  const [awardsToDecide, myComparisons] = await Promise.all([
    listAwardRecommendations(tenantId, { status: "SUBMITTED" }),
    listComparisons(tenantId),
  ]);
  const inProgressComparisons = myComparisons.filter((c) => c.createdById === user.id && (c.status === "DRAFT" || c.status === "SCORING"));

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="My Work" description="Assigned Procurement work items: award decisions, comparisons in progress and workflow approvals." />
      <ProcurementNav active="overview" />

      <Card><CardHeader><CardTitle>Award Recommendations Awaiting Decision</CardTitle></CardHeader><CardContent className="space-y-2">
        {awardsToDecide.length ? awardsToDecide.map((a) => (
          <Link key={a.id} href={`/dashboard/procurement/sourcing/awards/${a.id}`} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:border-gold">
            <div><span className="font-medium text-ink">{a.number}</span> <span className="text-ink-muted">— {a.recommendedSupplier.name}</span></div>
            <Badge status={a.status}>{a.status}</Badge>
          </Link>
        )) : <p className="py-4 text-center text-sm text-ink-faint">Nothing awaiting your decision.</p>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Comparisons In Progress</CardTitle></CardHeader><CardContent className="space-y-2">
        {inProgressComparisons.length ? inProgressComparisons.map((c) => (
          <Link key={c.id} href={`/dashboard/procurement/sourcing/comparisons/${c.id}`} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:border-gold">
            <div><span className="font-medium text-ink">{c.number}</span> <span className="text-ink-muted">— {c.rfq.title}</span></div>
            <Badge status={c.status}>{c.status}</Badge>
          </Link>
        )) : <p className="py-4 text-center text-sm text-ink-faint">No comparisons in progress.</p>}
      </CardContent></Card>
    </div>
  );
}
