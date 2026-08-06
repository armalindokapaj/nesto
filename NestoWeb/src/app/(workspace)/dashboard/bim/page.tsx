import Link from "next/link";
import { redirect } from "next/navigation";
import { Box } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { listBimModels } from "@/server/bim";
import { listProjects } from "@/server/projects";
import { getConfigResolver } from "@/server/platform-config";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RegisterBimModelDialog } from "@/components/bim/bim-dialogs";

// PRD_BIM_3D_Digital_Twin — adapted Phase-1 registry. No live 3D viewer;
// see the schema comment above BimModel for why.
export default async function BimModelsPage() {
  const { tenantId, role, company } = await getCurrentUser();
  if (!can(role, "PROJECTS", "READ")) redirect("/dashboard/executive");
  if (!(await getConfigResolver(tenantId, company?.id))("bim.page.models")) redirect("/dashboard/executive");
  const canWrite = can(role, "PROJECTS", "WRITE");

  const [models, projects] = await Promise.all([listBimModels(tenantId), listProjects(tenantId)]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">BIM Model Registry</h1>
          <p className="mt-0.5 text-sm text-ink-muted">Registered models, revisions and cross-module links — metadata only, no live 3D preview in this build.</p>
        </div>
        {canWrite && <RegisterBimModelDialog projects={projects.map((p) => ({ id: p.id, name: p.name }))} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {models.map((m) => (
          <Link key={m.id} href={`/dashboard/bim/${m.id}`} className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-gold/40">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-soft text-gold"><Box size={16} /></div>
              <Badge status={m.status}>{m.status}</Badge>
            </div>
            <p className="mt-3 font-medium text-ink">{m.name}</p>
            <p className="text-xs text-ink-faint">{m.discipline.replaceAll("_", " ")}</p>
            <p className="mt-2 text-xs text-ink-muted">{m._count.versions} version(s) · {m._count.links} linked record(s)</p>
          </Link>
        ))}
        {!models.length && <div className="col-span-full rounded-xl border border-dashed border-border py-16 text-center text-sm text-ink-faint">No BIM models registered yet.</div>}
      </div>
    </div>
  );
}
