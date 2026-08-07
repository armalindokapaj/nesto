import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listMyWorkItems } from "@/server/workflow-engine";
import { ProcurementNav, ProcurementPageHeader } from "@/components/procurement/procurement-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// §21.1 "Approvals sidebar entry opens My Approvals / relevant decision
// queue inside Procurement shell" — reuses the shared Workflow Engine's work
// items, filtered to this shell rather than a duplicate approval surface.
export default async function ProcurementApprovalsPage() {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "PROCUREMENT", "READ")) redirect("/dashboard/executive");
  const items = await listMyWorkItems(tenantId, user.id, role);

  return (
    <div className="space-y-6">
      <ProcurementPageHeader title="Approvals" description="Workflow owns routing, participants and decisions; Procurement owns the source record and final business state." />
      <ProcurementNav active="overview" />
      <Card><CardContent className="p-0"><Table><THead><TRow><TH>Workflow</TH><TH>Stage</TH><TH>Status</TH></TRow></THead><TBody>
        {items.map((i) => (
          <TRow key={i.id}>
            <TD className="font-medium text-ink">{i.workflowInstance.workflowDefinition.name}</TD>
            <TD className="text-ink-muted">{i.name}</TD>
            <TD><Badge status={i.status}>{i.status}</Badge></TD>
          </TRow>
        ))}
        {!items.length && <TRow><TD colSpan={3} className="py-12 text-center text-ink-faint">No approvals waiting on you.</TD></TRow>}
      </TBody></Table></CardContent></Card>
    </div>
  );
}
