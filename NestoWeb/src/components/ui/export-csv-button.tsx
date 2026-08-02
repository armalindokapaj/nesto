"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale-provider";

// Genuinely functional CSV export (built client-side from data already on
// the page) — not a decorative button. Values are quoted and internal
// quotes escaped so commas/quotes in text fields can't corrupt the file.
export function ExportCsvButton({ filename, rows }: { filename: string; rows: Record<string, string | number>[] }) {
  const { t } = useI18n();

  function handleExport() {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers.map(escape).join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleExport} disabled={rows.length === 0}>
      <Download size={14} /> {t("common.export")}
    </Button>
  );
}
