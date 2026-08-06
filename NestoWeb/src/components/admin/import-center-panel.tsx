"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, FileWarning, CheckCircle2 } from "lucide-react";
import { dryRunImportAction, commitImportAction } from "@/app/actions/import-center";
import type { ImportableEntity, ImportRowError } from "@/server/import-center";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/locale-provider";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

type DryRunResult = { validRows: unknown[]; errors: ImportRowError[] };
type CommitResult = { created: number; failed: ImportRowError[] };

export function ImportCenterPanel({ entities }: { entities: { key: ImportableEntity; label: string; columns: readonly string[] }[] }) {
  const { t } = useI18n();
  const [entity, setEntity] = useState<ImportableEntity>(entities[0].key);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = entities.find((e) => e.key === entity)!;

  function reset() {
    setDryRun(null);
    setCommitResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFile(file: File) {
    setError(null);
    setCommitResult(null);
    startTransition(async () => {
      try {
        const text = await file.text();
        const result = await dryRunImportAction(entity, text);
        setDryRun(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read file.");
      }
    });
  }

  function handleCommit() {
    if (!dryRun) return;
    startTransition(async () => {
      try {
        const result = await commitImportAction(entity, dryRun.validRows as never);
        setCommitResult(result);
        setDryRun(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        {!dryRun && !commitResult && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-muted">{t("importCenter.entityType")}</label>
              <select
                className={SELECT_CLASS}
                value={entity}
                onChange={(e) => {
                  setEntity(e.target.value as ImportableEntity);
                  reset();
                }}
                disabled={pending}
              >
                {entities.map((e) => (
                  <option key={e.key} value={e.key}>{e.label}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-ink-muted">{t("importCenter.columnsIntro")}</p>
            <code className="block rounded-lg bg-surface-sunken px-3 py-2 text-[0.7rem] text-ink-muted break-all">{active.columns.join(",")}</code>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              disabled={pending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-border"
            />
            {pending && <p className="text-xs text-ink-faint">{t("importCenter.validating")}</p>}
            {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
          </div>
        )}

        {dryRun && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-success">
                <CheckCircle2 size={14} /> {dryRun.validRows.length} {t("importCenter.validRows")}
              </span>
              {dryRun.errors.length > 0 && (
                <span className="flex items-center gap-1.5 text-danger">
                  <FileWarning size={14} /> {dryRun.errors.length} {t("importCenter.invalidRows")}
                </span>
              )}
            </div>
            {dryRun.errors.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2 text-xs text-ink-muted">
                {dryRun.errors.map((e, i) => (
                  <li key={i}>{t("importCenter.row")} {e.row}: {e.message}</li>
                ))}
              </ul>
            )}
            {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={reset} className="flex-1">{t("common.cancel")}</Button>
              <Button size="sm" disabled={pending || dryRun.validRows.length === 0} onClick={handleCommit} className="flex-1">
                <Upload size={14} /> {pending ? t("importCenter.importing") : `${t("importCenter.commitImport")} (${dryRun.validRows.length})`}
              </Button>
            </div>
          </div>
        )}

        {commitResult && (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              {t("importCenter.importComplete")} — {commitResult.created} {t("importCenter.created")}, {commitResult.failed.length} {t("importCenter.failedCount")}
            </p>
            {commitResult.failed.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2 text-xs text-ink-muted">
                {commitResult.failed.map((e, i) => (
                  <li key={i}>{t("importCenter.row")} {e.row}: {e.message}</li>
                ))}
              </ul>
            )}
            <Button size="sm" className="w-full" onClick={reset}>{t("importCenter.importMore")}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
