"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UNIT_LIFECYCLE_STATUSES, UNIT_LIFECYCLE_LABEL_KEY } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/locale-provider";

type Structure = { id: string; name: string; floors: { id: string; label: string }[] };

// PRD_Units §8 — filters serialize into the URL (shareable, browser-nav
// safe). Type is driven by the summary cards (multi-select there); status/
// structure/floor are single-select here for v1 rather than a full
// multi-select popover — a deliberate trim, not a missing requirement.
//
// `actions` carries the self-contained dialog triggers (CreateUnitDialog,
// CreateStructureDialog, ImportUnitsDialog) — same composition pattern as
// every other page in this app, rather than lifting their open state here.
export function UnitsToolbar({
  structures,
  projectId,
  canManage,
  actions,
}: {
  structures: Structure[];
  projectId: string;
  canManage: boolean;
  actions?: React.ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view = searchParams.get("view") ?? "table";
  const status = searchParams.get("status") ?? "";
  const structureId = searchParams.get("structureId") ?? "";
  const floorId = searchParams.get("floorId") ?? "";
  const sort = searchParams.get("sort") ?? "code_asc";
  const q = searchParams.get("q") ?? "";

  const selectedStructure = structures.find((s) => s.id === structureId);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    if (key === "structureId") params.delete("floorId");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder={t("units.searchPlaceholder")}
        defaultValue={q}
        onKeyDown={(e) => {
          if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
        }}
        className="w-48"
      />
      <select
        value={status}
        onChange={(e) => setParam("status", e.target.value)}
        className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      >
        <option value="">{t("units.allStatuses")}</option>
        {UNIT_LIFECYCLE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(UNIT_LIFECYCLE_LABEL_KEY[s])}
          </option>
        ))}
      </select>
      {structures.length > 0 && (
        <>
          <select
            value={structureId}
            onChange={(e) => setParam("structureId", e.target.value)}
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            <option value="">{t("units.allStructures")}</option>
            {structures.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {selectedStructure && selectedStructure.floors.length > 0 && (
            <select
              value={floorId}
              onChange={(e) => setParam("floorId", e.target.value)}
              className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              <option value="">{t("units.allFloors")}</option>
              {selectedStructure.floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </>
      )}
      <select
        value={sort}
        onChange={(e) => setParam("sort", e.target.value)}
        className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      >
        <option value="code_asc">{t("units.sortCodeAsc")}</option>
        <option value="code_desc">{t("units.sortCodeDesc")}</option>
        <option value="price_asc">{t("units.sortPriceAsc")}</option>
        <option value="price_desc">{t("units.sortPriceDesc")}</option>
        <option value="area_desc">{t("units.sortAreaDesc")}</option>
        <option value="createdAt_desc">{t("units.sortNewest")}</option>
      </select>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setParam("view", "table")}
            className={`flex h-8 w-8 items-center justify-center rounded-md ${view === "table" ? "bg-surface-sunken text-ink" : "text-ink-faint"}`}
            aria-label={t("units.tableView")}
          >
            <List size={15} />
          </button>
          <button
            type="button"
            onClick={() => setParam("view", "card")}
            className={`flex h-8 w-8 items-center justify-center rounded-md ${view === "card" ? "bg-surface-sunken text-ink" : "text-ink-faint"}`}
            aria-label={t("units.cardView")}
          >
            <LayoutGrid size={15} />
          </button>
        </div>
        {canManage && (
          <>
            <a href={`/api/units/export?projectId=${projectId}`} className="inline-flex">
              <Button variant="secondary" size="sm" type="button">
                <Download size={14} /> {t("common.export")}
              </Button>
            </a>
            {actions}
          </>
        )}
      </div>
    </div>
  );
}
