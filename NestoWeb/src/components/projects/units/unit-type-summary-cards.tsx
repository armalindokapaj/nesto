import Link from "next/link";
import { cn } from "@/lib/utils";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import type { UnitType } from "@/lib/constants";

type TypeSummary = { type: string; total: number; available: number; reserved: number; soldAssigned: number };

// PRD_Units §6 — one summary card per configured type; clicking applies or
// removes that type's filter. UNITS-003: counts already respect every other
// active filter (computed by getUnitTypeSummary), just not the type filter
// the card itself represents.
export function UnitTypeSummaryCards({
  summary,
  activeTypes,
  buildHref,
}: {
  summary: TypeSummary[];
  activeTypes: string[];
  buildHref: (nextTypes: string[]) => string;
}) {
  if (summary.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {summary.map((card) => {
        const isActive = activeTypes.includes(card.type);
        const nextTypes = isActive ? activeTypes.filter((t) => t !== card.type) : [...activeTypes, card.type];
        return (
          <Link
            key={card.type}
            href={buildHref(nextTypes)}
            className={cn(
              "rounded-xl border p-3.5 transition-colors",
              isActive ? "border-gold bg-gold-soft/40" : "border-border bg-surface hover:border-border-strong"
            )}
          >
            <p className="text-sm font-medium text-ink">{UNIT_TYPE_LABELS[card.type as UnitType] ?? card.type}</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{card.total}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
              <span>{card.available} avail.</span>
              <span>{card.reserved} held</span>
              <span>{card.soldAssigned} sold</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
