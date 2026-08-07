import { Badge } from "@/components/ui/badge";
import { DashboardGreeting } from "@/components/dashboards/dashboard-greeting";
import { FinanceScopeBar } from "@/components/dashboards/finance-scope-bar";
import { ProjectFinanceTabs } from "@/components/dashboards/project-finance-tabs";

export async function ProjectFinanceTabHeader({
  projectId,
  projectName,
  projectStatus,
  active,
}: {
  projectId: string;
  projectName: string;
  projectStatus: string;
  active: string;
}) {
  return (
    <>
      <DashboardGreeting greetingRole="FINANCE" />
      <FinanceScopeBar mode="project" projectName={projectName} />
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">{projectName}</h2>
        <Badge status={projectStatus}>{projectStatus}</Badge>
      </div>
      <ProjectFinanceTabs projectId={projectId} active={active} />
    </>
  );
}
