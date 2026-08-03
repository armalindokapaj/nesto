"use client";

import { useActionState, useRef } from "react";
import { saveThemeAction } from "@/app/actions/calendar";
import { THEMES } from "@/lib/constants";
import type { Theme } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/locale-provider";

// Applies immediately on selection — no separate Save step.
export function ThemeSelector({ currentTheme }: { currentTheme: Theme }) {
  const { t } = useI18n();
  const [state, formAction] = useActionState(saveThemeAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {THEMES.map((theme) => (
          <label key={theme} className="cursor-pointer">
            <input
              type="radio"
              name="theme"
              value={theme}
              defaultChecked={currentTheme === theme}
              onChange={() => formRef.current?.requestSubmit()}
              className="peer sr-only"
            />
            <div className="flex flex-col gap-1 rounded-xl border border-border p-3.5 transition-colors peer-checked:border-gold peer-checked:bg-gold-soft/40 hover:border-border-strong">
              <span className="text-sm font-medium text-ink">{t(`account.theme_${theme}`)}</span>
              <span className="text-xs text-ink-muted">{t(`account.themeDesc_${theme}`)}</span>
            </div>
          </label>
        ))}
      </div>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}
