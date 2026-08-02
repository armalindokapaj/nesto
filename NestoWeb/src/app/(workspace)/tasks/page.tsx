import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listTasks, listProjects } from "@/server/projects";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { TaskStatusSelect } from "@/components/projects/task-status-select";
import { DeleteTaskButton } from "@/components/projects/delete-task-button";
import { TaskDocumentsBadge } from "@/components/projects/task-documents-badge";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TASK_STATUS_KEY } from "@/lib/constants";
import type { TaskStatus } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import Link from "next/link";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; projectId?: string }>;
}) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "TASKS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "TASKS", "WRITE");

  const { status, projectId } = await searchParams;
  const [allTasks, projects] = await Promise.all([listTasks(tenantId), listProjects(tenantId)]);
  const tasks = allTasks.filter(
    (task) => (!status || task.status === status) && (!projectId || task.projectId === projectId)
  );
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("nav.tasks")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">{t("tasksPage.subtitle")}</p>
        </div>
        {canWrite && <CreateTaskDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <TaskFilters projects={projects.map((p) => ({ id: p.id, name: p.name }))} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("task.title")}</TH>
                <TH>{t("common.project")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("task.priority")}</TH>
                <TH>{t("common.assignee")}</TH>
                <TH>{t("common.dueDate")}</TH>
                <TH></TH>
              </TRow>
            </THead>
            <TBody>
              {tasks.map((task) => (
                <TRow key={task.id}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <div>
                        <Link href={`/tasks/${task.id}`} className="font-medium text-ink hover:text-gold hover:underline">{task.title}</Link>
                        <p className="text-xs text-ink-faint">{task.code}</p>
                      </div>
                      <TaskDocumentsBadge taskId={task.id} count={task._count.documents} />
                    </div>
                  </TD>
                  <TD className="text-ink-muted">
                    {task.project ? (
                      <Link href={`/projects/${task.project.id}`} className="hover:text-gold hover:underline">
                        {task.project.name}
                      </Link>
                    ) : (
                      t("tasksPage.unassignedProject")
                    )}
                  </TD>
                  <TD>
                    {canWrite ? (
                      <TaskStatusSelect taskId={task.id} projectId={task.projectId ?? undefined} status={task.status as TaskStatus} />
                    ) : (
                      <Badge status={task.status}>{t(TASK_STATUS_KEY[task.status as TaskStatus])}</Badge>
                    )}
                  </TD>
                  <TD>
                    {task.priority === "CRITICAL" || task.priority === "HIGH" ? (
                      <Badge tone={task.priority === "CRITICAL" ? "danger" : "warning"}>{t(`task.${task.priority.toLowerCase()}`)}</Badge>
                    ) : (
                      <span className="text-xs text-ink-faint">{t(`task.${task.priority.toLowerCase()}`)}</span>
                    )}
                  </TD>
                  <TD>
                    {task.mainResponsible ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={task.mainResponsible.displayName} color={task.mainResponsible.avatarColor} size={22} />
                        <span className="text-sm text-ink-muted">{task.mainResponsible.displayName}</span>
                      </div>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </TD>
                  <TD className="text-ink-muted">{task.dueDate ? formatDate(task.dueDate) : "—"}</TD>
                  <TD>{task.createdById === user.id && <DeleteTaskButton taskId={task.id} projectId={task.projectId ?? undefined} />}</TD>
                </TRow>
              ))}
              {tasks.length === 0 && (
                <TRow>
                  <TD colSpan={7} className="text-center text-ink-faint py-8">
                    {t("task.noTasks")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
