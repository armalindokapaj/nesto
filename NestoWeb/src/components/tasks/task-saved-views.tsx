"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bookmark, Plus, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { createSavedViewAction, deleteSavedViewAction } from "@/app/actions/tasks-module";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";

type SavedView = { id: string; name: string; layout: string; filtersJson: string | null };

export function TaskSavedViews({ views }: { views: SavedView[] }) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {views.map((v) => {
        const href = v.filtersJson ? `/tasks?${v.filtersJson}` : `/tasks${v.layout !== "LIST" ? `?layout=${v.layout.toLowerCase()}` : ""}`;
        return (
          <span key={v.id} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted hover:text-ink hover:bg-surface-sunken">
            <Link href={href} className="inline-flex items-center gap-1">
              <Bookmark size={11} /> {v.name}
            </Link>
            <button onClick={() => deleteSavedViewAction(v.id)} className="text-ink-faint hover:text-danger"><X size={11} /></button>
          </span>
        );
      })}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <Button size="sm" variant="ghost"><Plus size={13} /> {t("tasksPage.saveView")}</Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-base font-semibold text-ink">{t("tasksPage.saveView")}</Dialog.Title>
              <Dialog.Close className="text-ink-faint hover:text-ink"><X size={18} /></Dialog.Close>
            </div>
            <form action={async (fd) => { await createSavedViewAction(undefined, fd); setOpen(false); }} className="space-y-3.5">
              <input type="hidden" name="layout" value={(searchParams.get("layout") ?? "list").toUpperCase()} />
              <input type="hidden" name="filtersJson" value={searchParams.toString()} />
              <div className="space-y-1.5"><Label htmlFor="name">{t("common.name")}</Label><Input id="name" name="name" required /></div>
              <Button type="submit" className="w-full">{t("common.save")}</Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
