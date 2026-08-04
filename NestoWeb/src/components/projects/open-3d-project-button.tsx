"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Box, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "@/components/ui/coming-soon";
import { useI18n } from "@/lib/i18n/locale-provider";

// PRD_Rework_1 PROJ-009/010 — zero 3D/Unit infrastructure exists yet (no
// three.js dep, no Unit/Building model — "Units / Unit Page" is explicitly a
// future PRD). The action is present and styled per the reference design,
// but opens a Coming Soon state rather than a real 3D viewer.
export function Open3DProjectButton() {
  const { t } = useI18n();
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button size="sm">
          <Box size={14} /> {t("projects.open3DProject")}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-ink">{t("projects.open3DProject")}</Dialog.Title>
            <Dialog.Close className="text-ink-faint hover:text-ink">
              <X size={18} />
            </Dialog.Close>
          </div>
          <ComingSoon message={t("projects.open3DProjectComingSoon")} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
