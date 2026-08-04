import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { getProject } from "@/server/projects";
import { listContractsByProject } from "@/server/contracts";
import { listContractors } from "@/server/contractors";
import { listProjectDocuments } from "@/server/documents";
import { listProjectRenders } from "@/server/project-renders";
import { listProjectWorkPackages } from "@/server/project-work-packages";
import { listProjectApprovals } from "@/server/project-approvals";
import { listTenantMembersForPicker } from "@/server/project-members";
import { listMeetingsByProject } from "@/server/meetings";
import { getProjectFinanceDashboardData } from "@/server/project-finance";
import { listProjectPhotos } from "@/server/project-photos";
import { getUnitTypeSummary } from "@/server/units";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ProjectHeader } from "@/components/projects/project-header";
import { DocumentCategorySection } from "@/components/projects/document-category-section";
import { WorkPackageList } from "@/components/projects/work-package-list";
import { ApprovalList } from "@/components/projects/approval-list";
import { TeamRoster } from "@/components/projects/team-roster";
import { MeetingList } from "@/components/projects/meeting-list";
import { FinanceSummary } from "@/components/projects/finance-summary";
import { PhotoGallery } from "@/components/projects/photo-gallery";
import { ProjectUnitsSummary } from "@/components/projects/units/project-units-summary";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { can } from "@/lib/permissions";
import { canViewTask, canViewProjectFinance, getProjectRelationship } from "@/lib/project-access";
import { TASK_STATUS_KEY, TECHNICAL_DOCUMENT_CATEGORIES, GOVERNMENT_LEGAL_CATEGORIES } from "@/lib/constants";
import type { TaskStatus, Role } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId, role, user } = await getCurrentUser();
  const project = await getProject(tenantId, id, user.id);
  const canWrite = can(role, "TASKS", "WRITE");
  const canManageProject = can(role, "PROJECTS", "WRITE");
  const canViewContracts = can(role, "CONTRACTS", "READ");
  const canViewFinance = canViewProjectFinance(role as Role);
  const [contracts, documents, renders, workPackages, contractors, approvals, memberCandidates, meetings, financeData, photos, unitTypeSummary] =
    await Promise.all([
      canViewContracts ? listContractsByProject(tenantId, project.id) : Promise.resolve([]),
      listProjectDocuments(tenantId, project.id),
      listProjectRenders(tenantId, project.id),
      listProjectWorkPackages(tenantId, project.id),
      canManageProject ? listContractors(tenantId) : Promise.resolve([]),
      listProjectApprovals(tenantId, project.id),
      canManageProject ? listTenantMembersForPicker(tenantId) : Promise.resolve([]),
      listMeetingsByProject(tenantId, project.id),
      canViewFinance ? getProjectFinanceDashboardData(tenantId, project.id) : Promise.resolve(null),
      listProjectPhotos(tenantId, project.id),
      getUnitTypeSummary(tenantId, project.id, {}),
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

  // PRD_Rework_1 §9/§10 — Technical Documents and Government & Legal are
  // both DocumentFile.category filters (see lib/constants.ts); a doc in
  // neither list (e.g. legacy "General") appears in neither section.
  const technicalDocuments = documents.filter((d) => (TECHNICAL_DOCUMENT_CATEGORIES as readonly string[]).includes(d.category));
  const legalDocuments = documents.filter((d) => (GOVERNMENT_LEGAL_CATEGORIES as readonly string[]).includes(d.category));

  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> {t("projects.allProjects")}
      </Link>

      <ProjectHeader
        project={project}
        statusLabel={t(`projectStatus.${project.status}`)}
        relationshipLabel={{ label: t(`projects.relationship.${relationship}`), status: relationship }}
        pinned={project.pins.length > 0}
        renders={renders}
        canManage={canManageProject}
      />

      <ProjectUnitsSummary projectId={project.id} typeSummary={unitTypeSummary} />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("nav.tasks")}</CardTitle>
            <CardDescription>{t("projects.tasksSubtitle")}</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/tasks?projectId=${project.id}`} className="text-xs text-ink-muted hover:text-ink whitespace-nowrap">
              {t("projects.viewAllTasks")}
            </Link>
            {canWrite && <CreateTaskDialog projectId={project.id} />}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {visibleTasks.slice(0, 6).map((task) => (
            <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <Link href={`/tasks/${task.id}`} className="min-w-0 truncate text-sm text-ink hover:text-gold hover:underline">
                {task.title}
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                {task.mainResponsible && <Avatar name={task.mainResponsible.displayName} color={task.mainResponsible.avatarColor} size={20} />}
                <Badge status={task.status}>{t(TASK_STATUS_KEY[task.status as TaskStatus])}</Badge>
              </div>
            </div>
          ))}
          {visibleTasks.length === 0 && <p className="py-6 text-center text-sm text-ink-faint">{t("task.noTasks")}</p>}
        </CardContent>
      </Card>

      <WorkPackageList projectId={project.id} workPackages={workPackages} contractors={contractors} canManage={canManageProject} />

      <ApprovalList
        projectId={project.id}
        approvals={approvals}
        members={project.members.map((m) => m.user)}
        documents={documents}
        canManage={canManageProject}
        viewerId={user.id}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DocumentCategorySection
          title={t("projects.governmentLegalTitle")}
          description={t("projects.governmentLegalSubtitle")}
          categories={GOVERNMENT_LEGAL_CATEGORIES}
          documents={legalDocuments}
          projectId={project.id}
          canUpload={canManageProject}
          uploadLabel={t("documents.newDocument")}
          emptyLabel={t("projects.noGovernmentLegalDocuments")}
        />
        <DocumentCategorySection
          title={t("projects.technicalDocumentsTitle")}
          description={t("projects.technicalDocumentsSubtitle")}
          categories={TECHNICAL_DOCUMENT_CATEGORIES}
          documents={technicalDocuments}
          projectId={project.id}
          canUpload={canManageProject}
          uploadLabel={t("documents.newDocument")}
          emptyLabel={t("projects.noTechnicalDocuments")}
        />
      </div>

      <FinanceSummary
        data={financeData ?? { budget: null, committed: 0, expenses: 0, invoiced: 0, remaining: 0 }}
        canView={canViewFinance}
      />

      <TeamRoster projectId={project.id} members={project.members} candidates={memberCandidates} canManage={canManageProject} />

      <MeetingList projectId={project.id} meetings={meetings} canManage={canManageProject} />

      <PhotoGallery projectId={project.id} photos={photos} canManage={canManageProject} />

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
    </div>
  );
}
