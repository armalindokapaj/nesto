import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { listProjectsWithRelationship } from "@/server/projects";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { can } from "@/lib/permissions";
import { getProjectRelationship, canViewProjectFinance, PROJECT_RELATIONSHIPS } from "@/lib/project-access";
import { PROJECT_STATUSES } from "@/lib/constants";
import type { Role } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; relationship?: string }>;
}) {
  const { tenantId, role, user } = await getCurrentUser();
  const { status, relationship } = await searchParams;
  const allProjectsRaw = await listProjectsWithRelationship(tenantId);
  const canViewFinance = canViewProjectFinance(role as Role);

  // PRD_10 §5.1 — every project is discoverable company-wide; the relationship
  // badge tells the viewer *why* they're connected (or not) without hiding
  // the project itself.
  const allProjects = allProjectsRaw.map((p) => ({
    ...p,
    relationship: getProjectRelationship(
      { memberUserIds: p.members.map((m) => m.userId), tasks: p.tasks },
      { userId: user.id, role: role as Role }
    ),
  }));

  const projects = allProjects.filter(
    (p) =>
      (!status || !(PROJECT_STATUSES as readonly string[]).includes(status) || p.status === status) &&
      (!relationship || !(PROJECT_RELATIONSHIPS as readonly string[]).includes(relationship) || p.relationship === relationship)
  );
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="h-full hover:border-border-strong transition-colors">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{p.name}</p>
                      <p className="text-xs text-ink-muted">{p.code}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge status={p.status}>{t(`projectStatus.${p.status}`)}</Badge>
                      <Badge status={p.relationship}>{t(`projects.relationship.${p.relationship}`)}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-ink-muted">{p.clientName ?? t("projects.internalProject")}{p.location ? ` · ${p.location}` : ""}</p>
                  <div className="flex items-center gap-3">
                    <ProgressBar value={p.progressPct} tone={p.status === "DELAYED" ? "danger" : p.status === "AT_RISK" ? "warning" : "gold"} />
                    <span className="text-xs font-medium text-ink-muted w-9 text-right shrink-0">{p.progressPct}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink-faint pt-1 border-t border-border">
                    <span>{p._count.tasks} {p._count.tasks === 1 ? t("projects.taskCount") : t("projects.tasksCount")}</span>
                    {p.budget != null && (canViewFinance ? <span>{formatCurrency(p.budget)}</span> : <span>{t("projects.restricted")}</span>)}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
