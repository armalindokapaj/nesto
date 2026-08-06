"use client";

import { useActionState, useState, useTransition } from "react";
import { Eye, EyeOff, Plus, X, Repeat } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  toggleTaskWatchAction,
  addTaskLinkAction,
  removeTaskLinkAction,
  setTaskRecurrenceAction,
  stopTaskRecurrenceAction,
} from "@/app/actions/tasks-module";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

type TaskLink = { id: string; entityType: string; entityId: string; relationType: string | null };
type Recurrence = { id: string; frequency: string; interval: number; active: boolean; nextRunAt: Date } | null;

export function WatchTaskButton({ taskId, watching }: { taskId: string; watching: boolean }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [isWatching, setIsWatching] = useState(watching);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await toggleTaskWatchAction(taskId);
        setIsWatching(result.watching);
      })}
    >
      {isWatching ? <Eye size={14} /> : <EyeOff size={14} />} {isWatching ? t("tasksPage.unwatchTask") : t("tasksPage.watchTask")}
    </Button>
  );
}

export function TaskLinksCard({ taskId, links, canWrite }: { taskId: string; links: TaskLink[]; canWrite: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(addTaskLinkAction, undefined);
  return (
    <div className="space-y-2.5">
      <ul className="space-y-1.5">
        {links.map((l) => (
          <li key={l.id} className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">{l.entityType}: <span className="text-ink">{l.entityId}</span>{l.relationType ? ` (${l.relationType})` : ""}</span>
            {canWrite && <Button size="sm" variant="ghost" onClick={() => removeTaskLinkAction(l.id, taskId)}><X size={12} /></Button>}
          </li>
        ))}
        {links.length === 0 && <li className="text-sm text-ink-faint">{t("tasksPage.noLinks")}</li>}
      </ul>
      {canWrite && (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <Button size="sm" variant="secondary"><Plus size={13} /> {t("tasksPage.addLink")}</Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-base font-semibold text-ink">{t("tasksPage.addLink")}</Dialog.Title>
                <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
              </div>
              <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
                <input type="hidden" name="taskId" value={taskId} />
                <div className="space-y-1.5">
                  <Label htmlFor="entityType">{t("common.type")}</Label>
                  <select id="entityType" name="entityType" defaultValue="PROJECT" className={SELECT_CLASS}>
                    {["PROJECT", "CLIENT", "CONTRACT", "ASSET", "TASK", "OTHER"].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><Label htmlFor="entityId">ID</Label><Input id="entityId" name="entityId" required /></div>
                <div className="space-y-1.5"><Label htmlFor="relationType">{t("common.description")}</Label><Input id="relationType" name="relationType" /></div>
                {state && "error" in state && <p className="text-sm text-danger">{state.error}</p>}
                <Button type="submit" className="w-full">{t("common.save")}</Button>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}

export function TaskRecurrenceCard({ taskId, recurrence, canWrite }: { taskId: string; recurrence: Recurrence; canWrite: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(setTaskRecurrenceAction, undefined);

  if (recurrence?.active) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-muted flex items-center gap-1.5">
          <Repeat size={14} /> {t(`tasksPage.frequency_${recurrence.frequency}`)} ({t("tasksPage.everyNPeriods")} {recurrence.interval})
        </span>
        {canWrite && <Button size="sm" variant="ghost" onClick={() => stopTaskRecurrenceAction(recurrence.id, taskId)}>{t("tasksPage.stopRecurring")}</Button>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-faint">{t("tasksPage.recurrenceOff")}</p>
      {canWrite && (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <Button size="sm" variant="secondary"><Repeat size={13} /> {t("tasksPage.makeRecurring")}</Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <Dialog.Title className="text-base font-semibold text-ink">{t("tasksPage.makeRecurring")}</Dialog.Title>
                <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
              </div>
              <form action={async (fd) => { await formAction(fd); setOpen(false); }} className="space-y-3.5">
                <input type="hidden" name="taskId" value={taskId} />
                <div className="space-y-1.5">
                  <Label htmlFor="frequency">{t("tasksPage.frequency")}</Label>
                  <select id="frequency" name="frequency" defaultValue="WEEKLY" className={SELECT_CLASS}>
                    {["DAILY", "WEEKLY", "MONTHLY"].map((v) => <option key={v} value={v}>{t(`tasksPage.frequency_${v}`)}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><Label htmlFor="interval">{t("tasksPage.everyNPeriods")}</Label><Input id="interval" name="interval" type="number" min={1} defaultValue={1} /></div>
                {state && "error" in state && <p className="text-sm text-danger">{state.error}</p>}
                <Button type="submit" className="w-full">{t("common.save")}</Button>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
