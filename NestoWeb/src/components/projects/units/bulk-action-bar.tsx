"use client";

import { useState, useTransition } from "react";
import { Archive, X } from "lucide-react";
import { bulkUpdateUnitsAction, archiveUnitAction } from "@/app/actions/units";
import { Button } from "@/components/ui/button";
import { UNIT_LIFECYCLE_STATUSES, UNIT_LIFECYCLE_LABEL_KEY } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/locale-provider";

// PRD_Units §9 — bulk actions run synchronously in this app (no job queue);
// fine at real-world project scale (tens to low thousands of units, not the
// PRD's 50k ceiling — see the plan's "adapt to existing architecture" note).
export function BulkActionBar({ projectId, selectedIds, onClear }: { projectId: string; selectedIds: string[]; onClear: () => void }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null);

  function runBulkStatus(status: string) {
    startTransition(async () => {
      const results = await bulkUpdateUnitsAction(projectId, selectedIds, { status });
      setResult({ ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
    });
  }

  function runArchive() {
    startTransition(async () => {
      let ok = 0;
      let failed = 0;
      for (const id of selectedIds) {
        try {
          await archiveUnitAction(projectId, id);
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      setResult({ ok, failed });
    });
  }

  if (selectedIds.length === 0) return null;

  return (
    <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg">
      <span className="text-sm font-medium text-ink">{t("units.selectedCount").replace("{count}", String(selectedIds.length))}</span>
      <select
        disabled={pending}
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) runBulkStatus(e.target.value);
          e.target.value = "";
        }}
        className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-ink focus:outline-none focus:border-gold"
      >
        <option value="" disabled>
          {t("units.changeStatus")}
        </option>
        {UNIT_LIFECYCLE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(UNIT_LIFECYCLE_LABEL_KEY[s])}
          </option>
        ))}
      </select>
      <Button variant="secondary" size="sm" disabled={pending} onClick={runArchive}>
        <Archive size={13} /> {t("common.archive")}
      </Button>
      {result && (
        <span className="text-xs text-ink-muted">
          {t("units.bulkResult").replace("{ok}", String(result.ok)).replace("{failed}", String(result.failed))}
        </span>
      )}
      <button type="button" onClick={onClear} className="ml-auto text-ink-faint hover:text-ink">
        <X size={16} />
      </button>
    </div>
  );
}
