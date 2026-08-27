"use client";

import { useState, useTransition } from "react";
import { Play, Lock } from "lucide-react";
import { executeReportAction, issueReportExecutionAction } from "@/app/actions/analytics";
import { Button } from "@/components/ui/button";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { useI18n } from "@/lib/i18n/locale-provider";
import { toActionError } from "@/lib/errors";

// PRD_Reporting_Analytics — running a report always re-queries live (no
// cached rows anywhere), so "Run" and "Export" are two separate steps: run
// fetches fresh rows into the client, export just serializes what's already
// on screen. Re-running always re-fetches.
export function ReportRunner({ reportId, reportName }: { reportId: string; reportName: string }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Record<string, string | number>[] | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [issued, setIssued] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              setIssued(false);
              try {
                const result = await executeReportAction(reportId);
                setRows(result.rows as Record<string, string | number>[]);
                setExecutionId(result.executionId);
              } catch (e) {
                setError(toActionError(e, "Could not run report."));
              }
            })
          }
        >
          <Play size={14} /> {pending ? t("common.saving") : t("analytics.run")}
        </Button>
        {rows && <ExportCsvButton filename={reportName} rows={rows} />}
        {executionId && !issued && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => startTransition(async () => { await issueReportExecutionAction(executionId); setIssued(true); })}
          >
            <Lock size={14} /> {t("analytics.issueSnapshot")}
          </Button>
        )}
        {issued && <span className="text-xs text-success">{t("analytics.issued")}</span>}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {rows && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-sunken">
                {rows[0] && Object.keys(rows[0]).map((h) => <th key={h} className="px-2.5 py-1.5 text-left font-semibold text-ink-muted">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 25).map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {Object.values(row).map((v, j) => <td key={j} className="px-2.5 py-1.5 text-ink">{String(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-4 text-center text-ink-faint">{t("analytics.noRows")}</p>}
          {rows.length > 25 && <p className="px-2.5 py-1.5 text-ink-faint">{t("analytics.previewTruncated")}</p>}
        </div>
      )}
    </div>
  );
}
