import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getContractorWorkPackages } from "@/server/task-orchestration";
import { ContractorAssignmentCard } from "@/components/projects/contractor-assignment-card";
import { getT } from "@/lib/i18n/server";

// PRD_4 §10/§14 (CTO-100) — a contractor's entire workspace is this one
// restricted list of work packages. No project, client or finance module is
// reachable from here; getContractorWorkPackages() only ever returns fields
// the contractor is authorized to see.
export default async function ContractorDashboardPage() {
  const { tenantId, role, user } = await getCurrentUser();
  if (role !== "CONTRACTOR") redirect("/dashboard/executive");

  const assignments = await getContractorWorkPackages(tenantId, user.id);
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{t("orchestration.contractorDashboardTitle")}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("orchestration.contractorDashboardSubtitle")}</p>
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-ink-faint">
          {t("orchestration.noAssignments")}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {assignments.map((assignment) => (
            <ContractorAssignmentCard key={assignment.id} assignment={assignment} />
          ))}
        </div>
      )}
    </div>
  );
}
