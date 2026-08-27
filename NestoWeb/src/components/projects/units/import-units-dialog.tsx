"use client";

import { useRef, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Upload, X, FileWarning, CheckCircle2 } from "lucide-react";
import { dryRunUnitsImportAction, commitUnitsImportAction } from "@/app/actions/unit-import";
import type { ParsedImportRow, ImportRowError } from "@/server/unit-import";
import { UNIT_IMPORT_COLUMNS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";
import { toActionError } from "@/lib/errors";

type DryRunResult = { validRows: ParsedImportRow[]; errors: ImportRowError[] };
type CommitResult = { created: number; failed: ImportRowError[] };

// PRD_Units §10 — simplified synchronous import: upload CSV, dry-run
// validate, show row-level errors, commit valid rows. No async job/
// notification-center (no job queue in this app) and no XLSX/template
// generator (documented column list shown in the dialog instead).
export function ImportUnitsDialog({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const result = await dryRunUnitsImportAction(projectId, text);
        setDryRun(result);
      } catch (err) {
        setError(toActionError(err, "Could not read file."));
      }
    });
  }

  function handleCommit() {
    if (!dryRun) return;
    startTransition(async () => {
      try {
        const result = await commitUnitsImportAction(projectId, dryRun.validRows);
        setCommitResult(result);
        setDryRun(null);
      } catch (err) {
        setError(toActionError(err, "Import failed."));
      }
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="sm">
          <Upload size={14} /> {t("units.import")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("units.importTitle")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>

          {!dryRun && !commitResult && (
            <div className="space-y-3">
              <p className="text-xs text-ink-muted">{t("units.importColumnsIntro")}</p>
              <code className="block rounded-lg bg-surface-sunken px-3 py-2 text-[0.7rem] text-ink-muted break-all">
                {UNIT_IMPORT_COLUMNS.join(",")}
              </code>
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
              {pending && <p className="text-xs text-ink-faint">{t("units.validating")}</p>}
              {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
            </div>
          )}

          {dryRun && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 size={14} /> {t("units.validRows").replace("{count}", String(dryRun.validRows.length))}
                </span>
                {dryRun.errors.length > 0 && (
                  <span className="flex items-center gap-1.5 text-danger">
                    <FileWarning size={14} /> {t("units.invalidRows").replace("{count}", String(dryRun.errors.length))}
                  </span>
                )}
              </div>
              {dryRun.errors.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2 text-xs text-ink-muted">
                  {dryRun.errors.map((e, i) => (
                    <li key={i}>
                      {t("units.row")} {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
              {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={reset} className="flex-1">
                  {t("common.cancel")}
                </Button>
                <Button size="sm" disabled={pending || dryRun.validRows.length === 0} onClick={handleCommit} className="flex-1">
                  {pending ? t("units.importing") : t("units.commitImport").replace("{count}", String(dryRun.validRows.length))}
                </Button>
              </div>
            </div>
          )}

          {commitResult && (
            <div className="space-y-3">
              <p className="text-sm text-ink">
                {t("units.importComplete").replace("{created}", String(commitResult.created)).replace("{failed}", String(commitResult.failed.length))}
              </p>
              {commitResult.failed.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2 text-xs text-ink-muted">
                  {commitResult.failed.map((e, i) => (
                    <li key={i}>
                      {t("units.row")} {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
              <Button size="sm" className="w-full" onClick={() => setOpen(false)}>
                {t("common.close")}
              </Button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
