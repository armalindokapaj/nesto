import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { getProject } from "@/server/projects";
import { listUnits, getUnitTypeSummary } from "@/server/units";
import { listProjectStructures } from "@/server/project-structures";
import { canViewUnits, canManageUnits } from "@/lib/unit-access";
import { UnitTypeSummaryCards } from "@/components/projects/units/unit-type-summary-cards";
import { UnitsToolbar } from "@/components/projects/units/units-toolbar";
import { UnitsGrid } from "@/components/projects/units/units-grid";
import { CreateUnitDialog } from "@/components/projects/units/create-unit-dialog";
import { CreateStructureDialog } from "@/components/projects/units/create-structure-dialog";
import { ImportUnitsDialog } from "@/components/projects/units/import-units-dialog";
import { AccessDenied } from "@/components/ui/access-denied";
import { getT } from "@/lib/i18n/server";
import type { UnitSort } from "@/server/units";

export default async function UnitsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id: projectId } = await params;
  const { tenantId, role, user } = await getCurrentUser();
  const { t } = await getT();

  const project = await getProject(tenantId, projectId, user.id);

  if (!canViewUnits(role)) {
    return <AccessDenied backHref={`/projects/${projectId}`} backLabel={project.name} message={t("units.accessDenied")} />;
  }

  const sp = await searchParams;
  const view = sp.view === "card" ? "card" : "table";
  const types = sp.type ? sp.type.split(",").filter(Boolean) : [];
  const status = sp.status ? [sp.status] : [];
  const structureId = sp.structureId || undefined;
  const floorId = sp.floorId || undefined;
  const q = sp.q || undefined;
  const sort = (sp.sort as UnitSort) || "code_asc";
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;

  const [{ items, total, pageSize }, typeSummaryMap, structures] = await Promise.all([
    listUnits(tenantId, projectId, { type: types, status, structureId, floorId, q }, sort, page),
    getUnitTypeSummary(tenantId, projectId, { status, structureId, floorId, q }),
    listProjectStructures(tenantId, projectId),
  ]);

  const typeSummary = Array.from(typeSummaryMap.entries()).map(([type, counts]) => ({ type, ...counts }));
  const canManage = canManageUnits(role);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function buildTypeHref(nextTypes: string[]) {
    const params = new URLSearchParams();
    if (status[0]) params.set("status", status[0]);
    if (structureId) params.set("structureId", structureId);
    if (floorId) params.set("floorId", floorId);
    if (q) params.set("q", q);
    if (sort !== "code_asc") params.set("sort", sort);
    if (view !== "table") params.set("view", view);
    if (nextTypes.length) params.set("type", nextTypes.join(","));
    return `/projects/${projectId}/units?${params.toString()}`;
  }

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    if (types.length) params.set("type", types.join(","));
    if (status[0]) params.set("status", status[0]);
    if (structureId) params.set("structureId", structureId);
    if (floorId) params.set("floorId", floorId);
    if (q) params.set("q", q);
    if (sort !== "code_asc") params.set("sort", sort);
    if (view !== "table") params.set("view", view);
    params.set("page", String(nextPage));
    return `/projects/${projectId}/units?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> {project.name}
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("units.pageTitle")}</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            {project.name} · {t("units.unitCount").replace("{count}", String(total))}
          </p>
        </div>
      </div>

      <UnitTypeSummaryCards summary={typeSummary} activeTypes={types} buildHref={buildTypeHref} />

      <UnitsToolbar
        structures={structures}
        projectId={projectId}
        canManage={canManage}
        actions={
          <>
            <CreateStructureDialog projectId={projectId} />
            <ImportUnitsDialog projectId={projectId} />
            <CreateUnitDialog projectId={projectId} structures={structures} />
          </>
        }
      />

      <UnitsGrid projectId={projectId} units={items} view={view} canManage={canManage} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Link
            href={pageHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={`flex h-8 w-8 items-center justify-center rounded-md border border-border ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-surface-sunken"}`}
          >
            <ChevronLeft size={14} />
          </Link>
          <span className="text-xs text-ink-muted">{t("units.pageOf").replace("{page}", String(page)).replace("{total}", String(totalPages))}</span>
          <Link
            href={pageHref(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={`flex h-8 w-8 items-center justify-center rounded-md border border-border ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-surface-sunken"}`}
          >
            <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
