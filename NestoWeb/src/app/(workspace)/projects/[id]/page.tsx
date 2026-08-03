import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { getProject } from "@/server/projects";
import { listContractsByProject } from "@/server/contracts";
import { listProjectDocuments } from "@/server/documents";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TRow, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { TaskStatusSelect } from "@/components/projects/task-status-select";
import { DeleteTaskButton } from "@/components/projects/delete-task-button";
import { TaskDocumentsBadge } from "@/components/projects/task-documents-badge";
import { CreateDocumentDialog } from "@/components/documents/create-document-dialog";
import { can } from "@/lib/permissions";
import { canViewTask, canViewProjectFinance, getProjectRelationship } from "@/lib/project-access";
import { TASK_STATUS_KEY } from "@/lib/constants";
import type { TaskStatus, Role } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const BOARD_COLUMNS: TaskStatus[] = ["TO_DO", "IN_PROGRESS", "REVIEW", "COMPLETED"];

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, user } = await getCurrentUser();
  const project = await getProject(tenantId, id);
  const canWrite = can(role, "TASKS", "WRITE");
  const canUploadDocuments = can(role, "PROJECTS", "WRITE");
  const canViewContracts = can(role, "CONTRACTS", "READ");
  const canViewFinance = canViewProjectFinance(role as Role);
  const [contracts, documents] = await Promise.all([
    canViewContracts ? listContractsByProject(tenantId, project.id) : Promise.resolve([]),
    listProjectDocuments(tenantId, project.id),
  ]);
  const { t } = await getT();

  const viewer = { userId: user.id, role: role as Role };
  const relationship = getProjectRelationship(
    { memberUserIds: project.members.map((m) => m.userId), tasks: project.tasks },
    viewer
  );

  // PRD_10 FR-003/FR-004 — a task's own visibility gates it independently of
  // the project shell being open to everyone; hidden tasks are excluded from
  // the data itself (not just the UI), so counts/columns never leak them.
  const visibleTasks = project.tasks.filter((task) => canViewTask(task, viewer));

  const tasksByStatus = BOARD_COLUMNS.reduce<Record<TaskStatus, typeof visibleTasks>>((acc, s) => {
    acc[s] = visibleTasks.filter((task) => task.status === s || (s === "COMPLETED" && task.status === "APPROVED"));
    return acc;
  }, {} as Record<TaskStatus, typeof visibleTasks>);

  const overflowTasks = visibleTasks.filter((task) => !BOARD_COLUMNS.includes(task.status as TaskStatus) && task.status !== "APPROVED");

  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> {t("projects.allProjects")}
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-ink">{project.name}</h1>
            <Badge status={project.status}>{t(`projectStatus.${project.status}`)}</Badge>
            <Badge status={relationship}>{t(`projects.relationship.${relationship}`)}</Badge>
          </div>
          <p className="text-sm text-ink-muted mt-1">
            {project.code} · {project.clientName ?? t("projects.internalProject")}
            {project.location ? ` · ${project.location}` : ""}
          </p>
        </div>
        {canWrite && <CreateTaskDialog projectId={project.id} />}
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-ink-muted">{t("projects.progress")}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <ProgressBar value={project.progressPct} className="w-16" />
              <span className="text-sm font-medium text-ink">{project.progressPct}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-ink-muted">{t("projects.budget")}</p>
            <p className="text-sm font-medium text-ink mt-1.5">
              {!project.budget ? "—" : canViewFinance ? formatCurrency(project.budget) : t("projects.restricted")}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">{t("projects.team")}</p>
            <p className="text-sm font-medium text-ink mt-1.5">{project.members.length} {project.members.length === 1 ? t("projects.member") : t("projects.members")}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">{t("nav.tasks")}</p>
            <p className="text-sm font-medium text-ink mt-1.5">{project.tasks.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("projects.documentsTitle")}</CardTitle>
            <CardDescription>{t("projects.documentsSubtitle")}</CardDescription>
          </div>
          {canUploadDocuments && <CreateDocumentDialog projectId={project.id} triggerLabel={t("documents.newDocument")} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TRow>
                <TH>{t("documents.name")}</TH>
                <TH>{t("documents.category")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("documents.uploadedBy")}</TH>
                <TH>{t("dashboards.admin.joined")}</TH>
              </TRow>
            </THead>
            <TBody>
              {documents.map((doc) => (
                <TRow key={doc.id}>
                  <TD className="font-medium text-ink">{doc.name}</TD>
                  <TD className="text-ink-muted">{doc.category}</TD>
                  <TD>
                    <Badge status={doc.status}>{doc.status}</Badge>
                  </TD>
                  <TD className="text-ink-muted">{doc.uploadedBy.displayName}</TD>
                  <TD className="text-ink-muted">{formatDate(doc.createdAt)}</TD>
                </TRow>
              ))}
              {documents.length === 0 && (
                <TRow>
                  <TD colSpan={5} className="text-center text-ink-faint py-8">
                    {t("documents.noDocuments")}
                  </TD>
                </TRow>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {contracts.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("projects.contractorsTitle")}</CardTitle>
              <CardDescription>{t("projects.contractorsSubtitle")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contracts.map((contract) => (
                <li key={contract.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    {contract.contractor ? (
                      <Link
                        href={`/contractors/${contract.contractor.id}`}
                        className="text-sm font-medium text-ink hover:text-gold hover:underline"
                      >
                        {contract.contractor.name}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-ink">—</span>
                    )}
                    <Badge status={contract.status}>{t(`contracts.${contract.status.toLowerCase()}`)}</Badge>
                  </div>
                  <p className="text-xs text-ink-muted mt-1">
                    {contract.title} · {contract.contractor?.tradeType}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {BOARD_COLUMNS.map((status) => (
          <div key={status} className="rounded-xl border border-border bg-surface-sunken/60 flex flex-col min-h-[200px]">
            <div className="px-3.5 py-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t(TASK_STATUS_KEY[status])}</p>
              <span className="text-xs text-ink-faint">{tasksByStatus[status].length}</span>
            </div>
            <div className="flex-1 px-2.5 pb-2.5 space-y-2">
              {tasksByStatus[status].map((task) => (
                <div key={task.id} className="rounded-lg border border-border bg-surface p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/tasks/${task.id}`} className="text-sm font-medium text-ink leading-snug hover:text-gold hover:underline">
                      {task.title}
                    </Link>
                    {task.priority === "CRITICAL" || task.priority === "HIGH" ? (
                      <Badge tone={task.priority === "CRITICAL" ? "danger" : "warning"}>{task.priority}</Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[0.65rem] text-ink-faint">{task.code}</p>
                    <TaskDocumentsBadge taskId={task.id} count={task._count.documents} />
                  </div>
                  <div className="flex items-center justify-between">
                    {task.mainResponsible ? (
                      <Avatar name={task.mainResponsible.displayName} color={task.mainResponsible.avatarColor} size={22} />
                    ) : (
                      <span />
                    )}
                    <div className="flex items-center gap-1.5">
                      {canWrite ? (
                        <TaskStatusSelect taskId={task.id} projectId={project.id} status={task.status as TaskStatus} />
                      ) : (
                        <Badge status={task.status}>{t(TASK_STATUS_KEY[task.status as TaskStatus])}</Badge>
                      )}
                      {task.createdById === user.id && <DeleteTaskButton taskId={task.id} projectId={project.id} />}
                    </div>
                  </div>
                </div>
              ))}
              {tasksByStatus[status].length === 0 && (
                <p className="text-xs text-ink-faint text-center py-6">{t("task.noTasks")}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {overflowTasks.length > 0 && (
        <Card>
          <CardContent>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">{t("projects.otherStatuses")}</p>
            <ul className="space-y-2">
              {overflowTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between text-sm gap-3">
                  <span className="text-ink flex items-center gap-2 min-w-0">
                    <Link href={`/tasks/${task.id}`} className="truncate hover:text-gold hover:underline">
                      {task.title}
                    </Link>
                    <TaskDocumentsBadge taskId={task.id} count={task._count.documents} />
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {canWrite ? (
                      <TaskStatusSelect taskId={task.id} projectId={project.id} status={task.status as TaskStatus} />
                    ) : (
                      <Badge status={task.status}>{t(TASK_STATUS_KEY[task.status as TaskStatus])}</Badge>
                    )}
                    {task.createdById === user.id && <DeleteTaskButton taskId={task.id} projectId={project.id} />}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
