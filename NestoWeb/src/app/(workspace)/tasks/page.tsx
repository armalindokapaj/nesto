import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { canViewTask } from "@/lib/project-access";
import type { Role } from "@/lib/constants";
import { listTasks, listProjects } from "@/server/projects";
import { listStarredTaskIds, listSavedViews, processDueRecurrences } from "@/server/tasks-module";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { TaskStatusSelect } from "@/components/projects/task-status-select";
import { DeleteTaskButton } from "@/components/projects/delete-task-button";
import { TaskDocumentsBadge } from "@/components/projects/task-documents-badge";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskStarButton } from "@/components/tasks/task-star-button";
import { TaskLayoutSwitcher } from "@/components/tasks/task-layout-switcher";
import { TaskBoardView } from "@/components/tasks/task-board-view";
import { TaskCalendarView } from "@/components/tasks/task-calendar-view";
import { TaskTimelineView } from "@/components/tasks/task-timeline-view";
import { TaskSavedViews } from "@/components/tasks/task-saved-views";
import { TASK_STATUS_KEY } from "@/lib/constants";
import type { TaskStatus } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import Link from "next/link";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; projectId?: string; starred?: string; layout?: string; year?: string; month?: string }>;
}) {
  const { tenantId, role, user } = await getCurrentUser();
  if (!can(role, "TASKS", "READ")) redirect("/dashboard/executive");
  const canWrite = can(role, "TASKS", "WRITE");

  const { status, projectId, starred, layout, year, month } = await searchParams;
  await processDueRecurrences(tenantId);
  const [allTasks, projects, starredIds, savedViews] = await Promise.all([
    listTasks(tenantId),
    listProjects(tenantId),
    listStarredTaskIds(tenantId, user.id),
    listSavedViews(tenantId, user.id),
  ]);
  const viewer = { userId: user.id, role: role as Role };
  const tasks = allTasks.filter(
    (task) =>
      canViewTask(task, viewer) &&
      (!status || task.status === status) &&
      (!projectId || task.projectId === projectId) &&
      (!starred || starredIds.has(task.id))
  );
  const { t } = await getT();
  const now = new Date();
  const calendarYear = year ? Number(year) : now.getUTCFullYear();
  const calendarMonth = month ? Number(month) : now.getUTCMonth();

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
        <div className="flex items-center gap-2.5">
          <Link
            href={starred ? "/tasks" : "/tasks?starred=1"}
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
              (starred ? "border-gold/40 bg-gold/10 text-gold-deep" : "border-border text-ink-muted hover:text-ink hover:bg-surface-sunken")
            }
          >
            {t("task.starredTasks")}
          </Link>
          <TaskLayoutSwitcher />
        </div>
      </div>

      <TaskSavedViews views={savedViews} />

      {layout === "board" && <TaskBoardView tasks={tasks} starredIds={starredIds} />}
      {layout === "calendar" && <TaskCalendarView tasks={tasks} year={calendarYear} month={calendarMonth} />}
      {layout === "timeline" && <TaskTimelineView tasks={tasks} />}
      {(!layout || layout === "list") && (
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH className="w-6" />
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
                    <TaskStarButton taskId={task.id} starred={starredIds.has(task.id)} />
                  </TD>
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
                  <TD colSpan={8} className="text-center text-ink-faint py-8">
                    {t("task.noTasks")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
