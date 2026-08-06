import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { canViewTask } from "@/lib/project-access";
import type { Role } from "@/lib/constants";
import { getTaskOrchestration, getCompletionGateStatus } from "@/server/task-orchestration";
import { listComments } from "@/server/comments";
import { listAllMembers } from "@/server/admin";
import { listContractors } from "@/server/contractors";
import { listContracts } from "@/server/contracts";
import { listChecklistItems, isTaskStarred } from "@/server/tasks-module";
import { StartOrchestrationCard } from "@/components/projects/start-orchestration-card";
import { TaskOrchestrationView } from "@/components/projects/task-orchestration-view";
import { AccessDenied } from "@/components/ui/access-denied";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TaskStarButton } from "@/components/tasks/task-star-button";
import { TaskChecklist } from "@/components/tasks/task-checklist";
import { TaskComments } from "@/components/tasks/task-comments";
import { getT } from "@/lib/i18n/server";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "TASKS", "READ")) redirect("/dashboard/executive");

  const task = await getTaskOrchestration(tenantId, id);
  const { t } = await getT();

  // PRD_10 FR-005/AC-06 — a task's own visibility still gates a direct deep
  // link even though the coarse TASKS:READ check above already passed;
  // denial is neutral (no title/project/assignee) and audited.
  if (!canViewTask(task, { userId: user.id, role: role as Role })) {
    await db.auditEvent.create({
      data: { tenantId, actorId: user.id, action: "TASK_ACCESS_DENIED", targetType: "Task", targetId: id },
    });
    return <AccessDenied backHref="/tasks" backLabel={t("common.back")} message={t("task.restrictedMessage")} />;
  }

  const backHref = task.projectId ? `/projects/${task.projectId}` : task.clientId ? `/clients/${task.clientId}` : "/tasks";
  const canWrite = can(role, "TASKS", "WRITE");
  const [checklistItems, starred] = await Promise.all([
    listChecklistItems(tenantId, id),
    isTaskStarred(tenantId, id, user.id),
  ]);

  // §9/§14 — Checklist and Star apply to every task regardless of whether
  // PRD_4 orchestration has started; rendered once, below either branch.
  const checklistCard = (
    <Card>
      <CardHeader>
        <CardTitle>{t("task.checklist")}</CardTitle>
      </CardHeader>
      <CardContent>
        <TaskChecklist taskId={id} items={checklistItems} canWrite={canWrite} />
      </CardContent>
    </Card>
  );

  if (!task.currentStageId) {
    const [members, comments] = await Promise.all([listAllMembers(tenantId), listComments(tenantId, "Task", id)]);
    return (
      <div className="space-y-6">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft size={14} /> {t("common.back")}
        </Link>
        <div className="flex items-center gap-2">
          <TaskStarButton taskId={id} starred={starred} size={17} />
          <span className="text-sm text-ink-muted">{task.code}</span>
        </div>
        <StartOrchestrationCard
          taskId={task.id}
          taskCode={task.code}
          taskTitle={task.title}
          canStart={canWrite}
          members={members.map((m) => ({ id: m.user.id, displayName: m.user.displayName }))}
        />
        <Card>
          <CardHeader>
            <CardTitle>{t("task.comments")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskComments taskId={id} comments={comments} />
          </CardContent>
        </Card>
        {checklistCard}
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
      <div className="flex items-center gap-2">
        <TaskStarButton taskId={id} starred={starred} size={17} />
        <span className="text-sm text-ink-muted">{task.code}</span>
      </div>
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
      {checklistCard}
    </div>
  );
}
