import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { PinButton } from "@/components/projects/pin-button";

// PRD_Projects PD-03/AC-03 — the overview card shows ONLY image, name,
// location and owning company. No status, progress, budget or task counts
// (those were PRD_Rework_1's draft card spec; PRD_Projects is the later,
// more specific PRD for this exact page and explicitly excludes them —
// "Do not add status, progress, budget, task counts... to the card").
export type ProjectCardData = {
  id: string;
  name: string;
  location: string | null;
  company: { name: string } | null;
  pinnedRender: { id: string } | null;
  pinned: boolean;
};

// PRJ-CARD-001 — the whole card is clickable, but the pin control is its own
// interactive element, so the Link is a full-cover overlay (not a wrapper)
// to avoid nesting a <button> inside an <a> (invalid HTML, breaks keyboard
// navigation order and screen-reader semantics).
export function ProjectCard({ project }: { project: ProjectCardData }) {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-200 ease-[var(--motion-ease)] motion-safe:hover:-translate-y-1 hover:border-border-strong hover:shadow-lg">
      <Link href={`/projects/${project.id}`} className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
        <span className="sr-only">{project.name}</span>
      </Link>
      <div className="relative h-36 w-full shrink-0 overflow-hidden bg-surface-sunken">
        {project.pinnedRender ? (
          // eslint-disable-next-line @next/next/no-img-element -- served from our own blob API route, not a static/external asset
          <img
            src={`/api/project-renders/${project.pinnedRender.id}/file`}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Building2 size={28} className="text-ink-faint" />
          </div>
        )}
        <PinButton projectId={project.id} pinned={project.pinned} hoverOnly className="absolute right-2.5 top-2.5 z-20" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="truncate font-medium text-ink">{project.name}</p>
        <p className="flex min-w-0 items-center gap-1 truncate text-xs text-ink-muted">
          {project.company?.name}
          {project.location && (
            <>
              <span className="text-ink-faint">·</span>
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{project.location}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
