import { Building2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PinButton } from "@/components/projects/pin-button";
import { RenderGalleryDialog } from "@/components/projects/render-gallery-dialog";
import { Open3DProjectButton } from "@/components/projects/open-3d-project-button";

type Render = { id: string; uploadedBy: { displayName: string } };

// PRD_Rework_1 §6 — name/code/location/company/status/progress/pin on the
// left, cover image (click → render gallery) on the right; stacks on mobile.
export function ProjectHeader({
  project,
  statusLabel,
  relationshipLabel,
  pinned,
  renders,
  canManage,
}: {
  project: {
    id: string;
    name: string;
    code: string;
    location: string | null;
    status: string;
    progressPct: number;
    company: { name: string } | null;
    pinnedRender: { id: string } | null;
  };
  statusLabel: string;
  relationshipLabel: { label: string; status: string };
  pinned: boolean;
  renders: Render[];
  canManage: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-col sm:flex-row">
        <div className="flex-1 space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-ink">{project.name}</h1>
            <Badge status={project.status}>{statusLabel}</Badge>
            <Badge status={relationshipLabel.status}>{relationshipLabel.label}</Badge>
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
            <span>{project.code}</span>
            {project.company && (
              <>
                <span className="text-ink-faint">·</span>
                <span>{project.company.name}</span>
              </>
            )}
            {project.location && (
              <>
                <span className="text-ink-faint">·</span>
                <MapPin size={12} className="shrink-0" />
                <span>{project.location}</span>
              </>
            )}
          </p>
          <div className="flex max-w-xs items-center gap-3">
            <ProgressBar value={project.progressPct} />
            <span className="shrink-0 text-sm font-medium text-ink">{project.progressPct}%</span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Open3DProjectButton />
            <PinButton projectId={project.id} pinned={pinned} className="static bg-surface" />
          </div>
        </div>

        <RenderGalleryDialog projectId={project.id} renders={renders} pinnedRenderId={project.pinnedRender?.id ?? null} canManage={canManage}>
          <button type="button" className="group relative h-48 w-full shrink-0 overflow-hidden bg-surface-sunken sm:h-auto sm:w-72">
            {project.pinnedRender ? (
              // eslint-disable-next-line @next/next/no-img-element -- served from our own blob API route
              <img src={`/api/project-renders/${project.pinnedRender.id}/file`} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Building2 size={32} className="text-ink-faint" />
              </div>
            )}
            <span className="absolute inset-0 bg-ink/0 transition-colors group-hover:bg-ink/10" />
          </button>
        </RenderGalleryDialog>
      </div>
    </div>
  );
}
