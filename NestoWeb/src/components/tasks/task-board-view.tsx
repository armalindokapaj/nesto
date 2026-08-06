import Link from "next/link";
import { TASK_STATUSES, TASK_STATUS_KEY } from "@/lib/constants";
import type { TaskStatus } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { TaskStarButton } from "@/components/tasks/task-star-button";
import { formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

type BoardTask = {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  project: { id: string; name: string } | null;
  mainResponsible: { displayName: string; avatarColor: string } | null;
};

// PRD_Tasks_Module — Board/Kanban layout, one column per status. No
// drag-and-drop in this pass (would need a DnD library dependency); each
// card links through to the Task Page, where the existing status control
// already lives — keeps the reassignment surface in one place.
export async function TaskBoardView({ tasks, starredIds }: { tasks: BoardTask[]; starredIds: Set<string> }) {
  const { t } = await getT();
  const columns = TASK_STATUSES.map((status) => ({ status, tasks: tasks.filter((task) => task.status === status) }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map(({ status, tasks: columnTasks }) => (
        <div key={status} className="flex w-72 shrink-0 flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t(TASK_STATUS_KEY[status as TaskStatus])}</h3>
            <span className="text-xs text-ink-faint">{columnTasks.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {columnTasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="block rounded-xl border border-border bg-surface p-3 transition-colors hover:border-gold/40 hover:bg-surface-sunken"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{task.title}</p>
                  <TaskStarButton taskId={task.id} starred={starredIds.has(task.id)} size={14} />
                </div>
                <p className="mt-1 text-[0.68rem] text-ink-faint">{task.code}{task.project ? ` · ${task.project.name}` : ""}</p>
                <div className="mt-3 flex items-center justify-between">
                  {task.priority === "CRITICAL" || task.priority === "HIGH" ? (
                    <Badge tone={task.priority === "CRITICAL" ? "danger" : "warning"}>{t(`task.${task.priority.toLowerCase()}`)}</Badge>
                  ) : (
                    <span className="text-[0.68rem] text-ink-faint">{t(`task.${task.priority.toLowerCase()}`)}</span>
                  )}
                  {task.mainResponsible && <Avatar name={task.mainResponsible.displayName} color={task.mainResponsible.avatarColor} size={20} />}
                </div>
                {task.dueDate && <p className="mt-2 text-[0.68rem] text-ink-faint">{formatDate(task.dueDate)}</p>}
              </Link>
            ))}
            {columnTasks.length === 0 && <p className="rounded-xl border border-dashed border-border py-6 text-center text-[0.68rem] text-ink-faint">{t("task.noTasks")}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
