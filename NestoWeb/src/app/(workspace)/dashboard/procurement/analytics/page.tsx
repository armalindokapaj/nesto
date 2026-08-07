import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { StatTile } from "@/components/ui/stat-tile";
import { MessagesSquare, Users, ShieldCheck } from "lucide-react";

export default async function ProcurementAnalyticsPage() {
  const { tenantId, role } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");

  const [rfqs, suppliers] = await Promise.all([
    db.procurementRfq.findMany({ where: { tenantId }, include: { _count: { select: { suppliers: true, quotations: true } } } }),
    db.supplier.findMany({ where: { tenantId, archivedAt: null } }),
  ]);
  const invitations = rfqs.reduce((s, r) => s + r._count.suppliers, 0);
  const responses = rfqs.reduce((s, r) => s + r._count.quotations, 0);
  const responseRate = invitations ? Math.round((responses / invitations) * 100) : 0;
  const qualifiedPct = suppliers.length ? Math.round((suppliers.filter((s) => ["QUALIFIED", "PREFERRED"].includes(s.status)).length / suppliers.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Analytics" description="Sourcing and supplier analytics with an explicit date/scope basis. Deep trend analysis stays here, not on the dashboard." />
      <ProcurementNav active="overview" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="Supplier Response Rate" value={`${responseRate}%`} icon={MessagesSquare} iconColor="#2457C5" iconBg="#E4ECFB" />
        <StatTile label="RFQs Issued" value={String(rfqs.length)} icon={Users} iconColor="#B76E00" iconBg="#FBECD2" />
        <StatTile label="Qualified Supplier Share" value={`${qualifiedPct}%`} icon={ShieldCheck} iconColor="#1A7F4E" iconBg="#E2F4EA" />
      </div>
    </div>
  );
}
