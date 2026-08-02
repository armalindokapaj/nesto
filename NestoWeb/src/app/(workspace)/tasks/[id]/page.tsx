import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { getTaskOrchestration, getCompletionGateStatus } from "@/server/task-orchestration";
import { listComments } from "@/server/comments";
import { listAllMembers } from "@/server/admin";
import { listContractors } from "@/server/contractors";
import { listContracts } from "@/server/contracts";
import { StartOrchestrationCard } from "@/components/projects/start-orchestration-card";
import { TaskOrchestrationView } from "@/components/projects/task-orchestration-view";
import { getT } from "@/lib/i18n/server";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "TASKS", "READ")) redirect("/dashboard/executive");

  const task = await getTaskOrchestration(tenantId, id);
  const { t } = await getT();

  const backHref = task.projectId ? `/projects/${task.projectId}` : task.clientId ? `/clients/${task.clientId}` : "/tasks";

  if (!task.currentStageId) {
    const members = await listAllMembers(tenantId);
    return (
      <div className="space-y-6">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft size={14} /> {t("common.back")}
        </Link>
        <StartOrchestrationCard
          taskId={task.id}
          taskCode={task.code}
          taskTitle={task.title}
          canStart={can(role, "TASKS", "WRITE")}
          members={members.map((m) => ({ id: m.user.id, displayName: m.user.displayName }))}
        />
      </div>
    );
  }

  const [comments, members, contractors, contracts, gate] = await Promise.all([
    listComments(tenantId, "Task", id),
    listAllMembers(tenantId),
    listContractors(tenantId),
    listContracts(tenantId),
    getCompletionGateStatus(tenantId, id),
  ]);

  return (
    <div className="space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> {t("common.back")}
      </Link>
      <TaskOrchestrationView
        task={task}
        comments={comments}
        members={members.map((m) => ({ id: m.user.id, displayName: m.user.displayName, role: m.role }))}
        contractors={contractors}
        contracts={contracts}
        gate={gate}
        currentUserId={user.id}
        role={role}
      />
    </div>
  );
}
