"use client";

import { useEffect, useRef, useState } from "react";
import { getDraftAction, saveDraftAction, discardDraftAction } from "@/app/actions/drafts";

/**
 * PRD_Platform_UI_UX_Architecture §18 Universal Draft Mode — client-side
 * half of the pilot. Debounced autosave of a plain <form>'s field values
 * keyed by `formKey`; on mount, checks for a leftover draft and exposes it
 * so the caller can offer "Restore draft?" before the form even renders its
 * real values. Deliberately dumb about form internals (just FormData ->
 * plain object) — the calling component owns how restored values actually
 * get back into its inputs (uncontrolled inputs, so via defaultValue on a
 * delayed first render, same shape used below in CreateClientDialog).
 */
export function useDraft(formKey: string) {
  const [initialDraft, setInitialDraft] = useState<Record<string, string> | null | undefined>(undefined); // undefined = still loading
  const [dismissed, setDismissed] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDraftAction(formKey).then((result) => {
      if (!cancelled) setInitialDraft(result?.payload ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [formKey]);

  function onFormChange(form: HTMLFormElement) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const data = new FormData(form);
      const payload: Record<string, string> = {};
      data.forEach((value, key) => {
        if (typeof value === "string" && value.trim()) payload[key] = value;
      });
      if (Object.keys(payload).length > 0) saveDraftAction(formKey, payload);
    }, 800);
  }

  function dismissDraft() {
    setDismissed(true);
    discardDraftAction(formKey);
  }

  async function onSubmitted() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await discardDraftAction(formKey);
  }

  return {
    // Only offer to restore once loaded, present, and not already dismissed/restored this session.
    showRestoreBanner: initialDraft !== undefined && initialDraft !== null && !dismissed,
    draftValues: initialDraft ?? undefined,
    loaded: initialDraft !== undefined,
    onFormChange,
    dismissDraft,
    onSubmitted,
  };
}
