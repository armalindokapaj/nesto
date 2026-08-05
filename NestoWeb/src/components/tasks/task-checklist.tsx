"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  addChecklistItemAction,
  toggleChecklistItemAction,
  deleteChecklistItemAction,
} from "@/app/actions/tasks-module";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale-provider";

export type ChecklistItem = {
  id: string;
  title: string;
  completed: boolean;
  dueAt: Date | string | null;
  owner: { id: string; displayName: string; avatarColor: string | null } | null;
  completedBy: { id: string; displayName: string } | null;
};

// §9 Shared Checklist — any participant may add, claim or complete an item;
// every flip is written to the Activity Timeline server-side (tasks-module.ts).
export function TaskChecklist({ taskId, items, canWrite }: { taskId: string; items: ChecklistItem[]; canWrite: boolean }) {
  const { t } = useI18n();
  const [, formAction, pending] = useActionState(addChecklistItemAction, undefined);
  const done = items.filter((i) => i.completed).length;
  const total = items.length;

  return (
    <div className="space-y-3">
      {total > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-ink-faint">
            {done}/{total}
          </span>
        </div>
      )}

      <ul className="space-y-1.5">
        {items.map((item) => (
          <ChecklistRow key={item.id} taskId={taskId} item={item} canWrite={canWrite} />
        ))}
        {items.length === 0 && <p className="text-xs text-ink-faint">{t("task.checklistEmpty")}</p>}
      </ul>

      {canWrite && (
        <form action={formAction} className="flex items-center gap-2 pt-1">
          <input type="hidden" name="taskId" value={taskId} />
          <Input name="title" placeholder={t("task.addChecklistItem")} className="h-9 flex-1" />
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {t("common.create")}
          </Button>
        </form>
      )}
    </div>
  );
}

function ChecklistRow({ taskId, item, canWrite }: { taskId: string; item: ChecklistItem; canWrite: boolean }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  return (
    <li className="group flex items-start gap-2.5 rounded-lg px-1.5 py-1 hover:bg-surface-sunken">
      <button
        type="button"
        disabled={!canWrite || isPending}
        onClick={() => startTransition(() => toggleChecklistItemAction(item.id, taskId))}
        aria-pressed={item.completed}
        aria-label={item.completed ? t("task.markIncomplete") : t("task.markComplete")}
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          item.completed ? "border-gold bg-gold text-white" : "border-border"
        )}
      >
        {item.completed && (
          <svg viewBox="0 0 12 12" width="9" height="9" fill="none">
            <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", item.completed ? "text-ink-faint line-through" : "text-ink")}>{item.title}</p>
        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-ink-faint">
          {item.owner && <span>{item.owner.displayName}</span>}
          {item.dueAt && <span>{formatDate(item.dueAt)}</span>}
          {item.completed && item.completedBy && (
            <span>
              {t("task.completedBy")} {item.completedBy.displayName}
            </span>
          )}
        </div>
      </div>
      {canWrite && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => deleteChecklistItemAction(item.id, taskId))}
          className="shrink-0 text-ink-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
          aria-label={t("common.delete")}
        >
          <Trash2 size={13} />
        </button>
      )}
    </li>
  );
}
