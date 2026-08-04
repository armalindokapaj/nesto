import Link from "next/link";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UNIT_TYPE_LABELS, UNIT_LIFECYCLE_LABEL_KEY } from "@/lib/constants";
import type { UnitType, UnitLifecycleStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import type { UnitRow } from "@/components/projects/units/units-table";

type PricedUnitRow = UnitRow & { pinnedRender: { id: string } | null };

// Plain presentational function (no server-only calls, `t` passed in) so it
// can be rendered from either a Server Component or the client-side
// UnitsGrid selection wrapper without crossing the RSC boundary incorrectly.
export function UnitsCardGrid({
  projectId,
  units,
  t,
  selectable,
  selected,
  onToggleSelect,
}: {
  projectId: string;
  units: PricedUnitRow[];
  t: (key: string) => string;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  if (units.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-faint">{t("units.noUnits")}</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {units.map((unit) => (
        <div key={unit.id} className="relative">
          {selectable && (
            <input
              type="checkbox"
              checked={selected?.has(unit.id) ?? false}
              onChange={() => onToggleSelect?.(unit.id)}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-2.5 top-2.5 z-10 rounded border-border-strong accent-gold"
            />
          )}
          <Link href={`/projects/${projectId}/units/${unit.id}`} className="block h-full">
            <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-200 hover:-translate-y-1 hover:border-border-strong hover:shadow-lg">
              <div className="relative h-32 w-full shrink-0 overflow-hidden bg-surface-sunken">
                {unit.pinnedRender ? (
                  // eslint-disable-next-line @next/next/no-img-element -- served from our own blob API route
                  <img src={`/api/unit-renders/${unit.pinnedRender.id}/file`} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Building2 size={26} className="text-ink-faint" />
                  </div>
                )}
                <Badge status={unit.lifecycleStatus} className="absolute right-2 top-2 bg-surface/90 backdrop-blur-sm">
                  {t(UNIT_LIFECYCLE_LABEL_KEY[unit.lifecycleStatus as UnitLifecycleStatus] ?? unit.lifecycleStatus)}
                </Badge>
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3.5">
                <p className="truncate font-medium text-ink">{unit.code}</p>
                <p className="truncate text-xs text-ink-muted">
                  {UNIT_TYPE_LABELS[unit.type as UnitType] ?? unit.type}
                  {unit.structure ? ` · ${unit.structure.name}` : ""}
                  {unit.floor ? ` · ${unit.floor.label}` : ""}
                </p>
                <p className="mt-auto pt-2 text-sm font-medium text-ink">{formatCurrency(unit.finalPriceValue, unit.currency)}</p>
              </div>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}
