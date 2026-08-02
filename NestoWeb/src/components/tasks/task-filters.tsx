"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TASK_STATUSES, TASK_STATUS_KEY } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/locale-provider";

export function TaskFilters({ projects }: { projects: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/tasks${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <select
        defaultValue={searchParams.get("status") ?? ""}
        onChange={(e) => updateParam("status", e.target.value)}
        className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      >
        <option value="">{t("tasksPage.allStatuses")}</option>
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(TASK_STATUS_KEY[s])}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("projectId") ?? ""}
        onChange={(e) => updateParam("projectId", e.target.value)}
        className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      >
        <option value="">{t("tasksPage.allProjects")}</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
