import { getCurrentUser } from "@/lib/dal";
import { listProjectsWithRelationship } from "@/server/projects";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectCard } from "@/components/projects/project-card";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { can } from "@/lib/permissions";
import { getProjectRelationship, PROJECT_RELATIONSHIPS } from "@/lib/project-access";
import { PROJECT_STATUSES } from "@/lib/constants";
import type { Role } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; relationship?: string }>;
}) {
  const { tenantId, role, user } = await getCurrentUser();
  const { status, relationship } = await searchParams;
  const allProjectsRaw = await listProjectsWithRelationship(tenantId, user.id);

  // PRD_10 §5.1 — every project is discoverable company-wide; the relationship
  // badge tells the viewer *why* they're connected (or not) without hiding
  // the project itself.
  const allProjects = allProjectsRaw.map((p) => ({
    ...p,
    relationship: getProjectRelationship(
      { memberUserIds: p.members.map((m) => m.userId), tasks: p.tasks },
      { userId: user.id, role: role as Role }
    ),
    pinned: p.pins.length > 0,
  }));

  const projects = allProjects
    .filter(
      (p) =>
        (!status || !(PROJECT_STATUSES as readonly string[]).includes(status) || p.status === status) &&
        (!relationship || !(PROJECT_RELATIONSHIPS as readonly string[]).includes(relationship) || p.relationship === relationship)
    )
    // PRD_Rework_1 PROJ-003 — pinned projects sort first, per viewer.
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const canCreate = can(role, "PROJECTS", "WRITE");
  const { t } = await getT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("projects.title")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            {status ? `${t("projects.subtitle")} · ${t(`projectStatus.${status}`)}` : t("projects.subtitle")}
          </p>
        </div>
        {canCreate && <CreateProjectDialog />}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-ink-faint">
              {t("projects.noProjects")} {canCreate && !status ? t("projects.noProjectsCreateFirst") : ""}
            </p>
          </CardContent>
        </Card>
      ) : (
        // PRD_Projects §10 — 1 col <600px, 2 cols 600-1023px, 3 cols 1024-1279px, 4 cols >=1280px.
        // Tailwind's default breakpoints (sm=640, lg=1024, xl=1280) line up closely enough to reuse as-is.
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
