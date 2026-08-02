"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, ShieldCheck, ArrowRight, User, Lock } from "lucide-react";
import { login } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NestoMark } from "@/components/branding/NestoLogo";
import { useI18n } from "@/lib/i18n/locale-provider";

export function LoginForm() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-border bg-surface shadow-[0_8px_30px_rgba(26,29,35,0.06)]">
      <div className="px-8 pt-7 pb-5 text-center">
        <NestoMark size={36} className="text-gold mx-auto" />
        <h1 className="mt-3 font-serif text-2xl text-ink">{t("auth.signInToNesto")}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{t("auth.accessWorkspace")}</p>
        <div className="mt-3 h-px w-10 bg-gold mx-auto" />
      </div>

      <form action={formAction} className="px-8 pb-5 space-y-3.5">
        <div className="space-y-1.5">
          <label htmlFor="identifier" className="text-xs font-medium text-ink-muted">
            {t("auth.identifierLabel")}
          </label>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              id="identifier"
              name="identifier"
              placeholder={t("auth.identifierPlaceholder")}
              className="pl-9"
              autoComplete="username"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-ink-muted">
            {t("auth.passwordLabel")}
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.passwordPlaceholder")}
              className="pl-9 pr-9"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 text-ink-muted">
            <input type="checkbox" name="remember" className="rounded border-border-strong accent-gold" />
            {t("auth.rememberMe")}
          </label>
          <a href="#" className="font-medium text-gold hover:underline">
            {t("auth.forgotPassword")}
          </a>
        </div>

        {state?.error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full" size="lg">
          {pending ? t("auth.signingIn") : t("auth.signIn")}
        </Button>

        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="flex items-center gap-1.5 text-[0.7rem] text-ink-faint">
            <ShieldCheck size={12} /> {t("auth.secureAccess")}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </form>

      <div className="border-t border-border px-8 py-4 text-center">
        <a href="/apply" className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:underline">
          {t("auth.applyForSignUp")} <ArrowRight size={14} />
        </a>
      </div>
    </div>
  );
}
