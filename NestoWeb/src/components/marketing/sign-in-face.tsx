"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Eye, EyeOff, ShieldCheck, ArrowRight, User, Lock, ChevronDown } from "lucide-react";
import { login } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NestoMark } from "@/components/branding/NestoLogo";
import { ForgotPasswordDialog } from "@/components/marketing/forgot-password-dialog";
import { useI18n } from "@/lib/i18n/locale-provider";

type FieldHint = { field: "identifier" | "password"; id: number } | null;

const DEMO_LOGINS = [
  { username: "Owner", role: "Company Owner" },
  { username: "Admin", role: "Company Admin" },
  { username: "Ceo", role: "CEO / Director" },
  { username: "Pm", role: "Project Manager" },
  { username: "Architect", role: "Architect" },
  { username: "Engineer", role: "Engineer" },
  { username: "Hr", role: "HR" },
  { username: "Finance", role: "Finance" },
  { username: "Legal", role: "Legal" },
  { username: "Sales", role: "Sales / Commercial" },
  { username: "Procurement", role: "Procurement" },
  { username: "Stock", role: "Stock / Quantity Manager" },
  { username: "Qaqc", role: "QA/QC" },
  { username: "Hse", role: "HSE" },
  { username: "Contractor", role: "Contractor Representative" },
  { username: "Client", role: "Client" },
  { username: "Viewer", role: "Viewer / Trainee" },
] as const;
const DEMO_PASSWORD = "1";

// Restarts a CSS animation on an element even if its animation class never
// actually left (e.g. two wrong attempts in a row, where `state?.error` is
// truthy both times, so nothing in React's className output ever changes)
// — remove the class, force a style recalculation by reading a layout
// property, then re-add it. This is the standard fix for "the same class
// was already applied" not replaying an animation, and — unlike keying the
// element to force a remount — never risks clearing the surrounding form's
// (uncontrolled) input values. Neither element needs the class in its
// static JSX className; this effect is the only thing that ever adds it.
function replayAnimation(el: HTMLElement | null, className: string) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

// Front face of the landing-page auth card. The error slot is always
// mounted (fixed height) so a validation error never resizes or shifts the
// fixed-size card, and "Apply for sign up" flips the parent card instead of
// navigating away. Sized for a 350x480 card — every spacing/type value here
// is deliberately compact (see auth-card.tsx).
//
// Native browser validation ("Please fill out this field") is replaced with
// a small custom tooltip (auth.fieldRequired) so the copy and animation
// match the rest of the card on both mobile and desktop.
export function SignInFace({ onRequestSignUp }: { onRequestSignUp: () => void }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [hint, setHint] = useState<FieldHint>(null);
  const [showDemoLogins, setShowDemoLogins] = useState(false);
  // React 19 resets uncontrolled fields after any <form action={fn}> submit
  // completes — including a *failed* one. Left alone, a wrong password would
  // also silently wipe the username the visitor just typed. Password stays
  // uncontrolled (clearing it after a failed attempt is a deliberate, common
  // security-conscious pattern); identifier is controlled specifically to
  // opt out of that auto-reset.
  const [identifierValue, setIdentifierValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");

  const cardRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state?.error) return;
    replayAnimation(cardRef.current, "auth-card-shake");
    replayAnimation(bannerRef.current, "premium-pop-in");
  }, [state]);

  // Auto-dismiss the "this needs to be filled" hint if the visitor doesn't
  // start typing — a timeout callback inside an effect (not a synchronous
  // setState in the effect body), so this is the sanctioned "respond to an
  // external timer" pattern rather than a render-cascade risk.
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(null), 2600);
    return () => clearTimeout(timer);
  }, [hint]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const identifier = form.elements.namedItem("identifier") as HTMLInputElement;
    const password = form.elements.namedItem("password") as HTMLInputElement;
    if (!identifier.value.trim()) {
      e.preventDefault();
      setHint({ field: "identifier", id: Date.now() });
      identifier.focus();
      return;
    }
    if (!password.value.trim()) {
      e.preventDefault();
      setHint({ field: "password", id: Date.now() });
      password.focus();
    }
  }

  function selectDemoLogin(username: string) {
    setIdentifierValue(username);
    setPasswordValue(DEMO_PASSWORD);
    setShowDemoLogins(false);
    setHint(null);
    requestAnimationFrame(() => passwordRef.current?.focus());
  }

  return (
    <div ref={cardRef} className="flex h-full flex-col">
      <div className="px-7 pt-6 pb-3 text-center">
        <NestoMark size={28} className="text-gold mx-auto" />
        <h1 className="mt-2 font-serif text-lg text-ink">{t("auth.signInToNesto")}</h1>
        <p className="mt-1 text-xs text-ink-muted">{t("auth.accessWorkspace")}</p>
        <div className="mt-2 h-px w-8 bg-gold mx-auto" />
      </div>

      <form action={formAction} onSubmit={handleSubmit} noValidate className="flex-1 px-7 pb-3 space-y-2.5">
        <div className="space-y-1">
          <label htmlFor="identifier" className="text-xs font-medium text-ink-muted">
            {t("auth.identifierLabel")}
          </label>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              id="identifier"
              name="identifier"
              placeholder={t("auth.identifierPlaceholder")}
              className="h-9 pl-8 text-sm"
              autoComplete="username"
              required
              value={identifierValue}
              onFocus={() => setShowDemoLogins(true)}
              onChange={(e) => {
                setIdentifierValue(e.target.value);
                setShowDemoLogins(true);
                setHint((h) => (h?.field === "identifier" ? null : h));
              }}
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowDemoLogins((open) => !open)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:bg-surface-raised hover:text-ink-muted"
              aria-label="Show test user roles"
              aria-expanded={showDemoLogins}
            >
              <ChevronDown size={14} />
            </button>
            {showDemoLogins && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
                <p className="border-b border-border bg-surface-raised px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-faint">
                  Test roles — password is filled automatically
                </p>
                {DEMO_LOGINS.map(({ username, role }) => (
                  <button
                    key={username}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectDemoLogin(username)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-gold-soft"
                  >
                    <span className="font-medium text-ink">{username}</span>
                    <span className="text-ink-muted">{role}</span>
                  </button>
                ))}
              </div>
            )}
            {hint?.field === "identifier" && (
              <div key={hint.id} className="field-hint-bubble premium-pop-in">
                {t("auth.fieldRequired")}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-xs font-medium text-ink-muted">
            {t("auth.passwordLabel")}
          </label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              ref={passwordRef}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.passwordPlaceholder")}
              className="h-9 pl-8 pr-8 text-sm"
              autoComplete="current-password"
              required
              value={passwordValue}
              onChange={(e) => {
                setPasswordValue(e.target.value);
                setHint((h) => (h?.field === "password" ? null : h));
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            {hint?.field === "password" && (
              <div key={hint.id} className="field-hint-bubble premium-pop-in">
                {t("auth.fieldRequired")}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-1.5 text-ink-muted">
            <input type="checkbox" name="remember" className="rounded border-border-strong accent-gold" />
            {t("auth.rememberMe")}
          </label>
          <ForgotPasswordDialog />
        </div>

        <div className="flex h-7 items-center justify-center">
          {state?.error && (
            <div
              ref={bannerRef}
              role="alert"
              className="premium-pop-in flex max-w-full items-center gap-1.5 rounded-full border border-danger/25 bg-danger-soft px-3 py-1 text-xs font-medium text-danger shadow-sm"
            >
              <AlertCircle size={13} className="shrink-0" />
              <span className="truncate">{state.error}</span>
            </div>
          )}
        </div>

        <Button type="submit" disabled={pending} className="w-full" size="md">
          {pending ? t("auth.signingIn") : t("auth.signIn")}
        </Button>

        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="flex items-center gap-1 text-[0.65rem] text-ink-faint">
            <ShieldCheck size={11} /> {t("auth.secureAccess")}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </form>

      <div className="border-t border-border px-7 py-3 text-center">
        <button
          type="button"
          onClick={onRequestSignUp}
          className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:underline"
        >
          {t("auth.applyForSignUp")} <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
