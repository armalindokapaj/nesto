"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Briefcase, HardHat } from "lucide-react";
import { registerAction, loginPublicAction } from "@/app/actions/public-signup";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { PublicAccountType } from "@/lib/constants";

type View = "select" | "register" | "signin";

export function ApplyEntry() {
  const { t, locale } = useI18n();
  const [view, setView] = useState<View>("select");
  const [accountType, setAccountType] = useState<PublicAccountType>("PROFESSIONAL");
  const [registerState, registerFormAction, registerPending] = useActionState(registerAction, undefined);
  const [loginState, loginFormAction, loginPending] = useActionState(loginPublicAction, undefined);

  if (view === "select") {
    return (
      <div className="w-full max-w-2xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => {
              setAccountType("PROFESSIONAL");
              setView("register");
            }}
            className="text-left rounded-2xl border border-border bg-surface p-6 hover:border-gold transition-colors"
          >
            <Briefcase size={22} className="text-gold" />
            <p className="mt-3 font-serif text-lg text-ink">{t("apply.professionalCardTitle")}</p>
            <p className="mt-1 text-sm text-ink-muted">{t("apply.professionalCardBody")}</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setAccountType("CONTRACTOR");
              setView("register");
            }}
            className="text-left rounded-2xl border border-border bg-surface p-6 hover:border-gold transition-colors"
          >
            <HardHat size={22} className="text-gold" />
            <p className="mt-3 font-serif text-lg text-ink">{t("apply.contractorCardTitle")}</p>
            <p className="mt-1 text-sm text-ink-muted">{t("apply.contractorCardBody")}</p>
          </button>
        </div>
        <p className="text-center text-sm text-ink-muted">
          {t("apply.alreadyHaveAccount")}{" "}
          <button type="button" onClick={() => setView("signin")} className="font-medium text-gold hover:underline">
            {t("auth.signIn")}
          </button>
        </p>
        <p className="text-center">
          <Link href="/" className="text-sm text-ink-faint hover:text-ink-muted">
            {t("apply.backToCompanySignIn")}
          </Link>
        </p>
      </div>
    );
  }

  if (view === "signin") {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 space-y-3.5">
          <form action={loginFormAction} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">{t("auth.identifierLabel")}</Label>
              <Input id="identifier" name="identifier" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth.passwordLabel")}</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {loginState && "error" in loginState && <p className="text-xs text-danger">{loginState.error}</p>}
            <Button type="submit" disabled={loginPending} className="w-full">
              {loginPending ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
          <button type="button" onClick={() => setView("select")} className="w-full text-center text-xs text-ink-faint hover:text-ink-muted">
            {t("common.back")}
          </button>
        </CardContent>
      </Card>
    );
  }

  // view === "register"
  // On success, registerAction sets the new public session cookie but does
  // not redirect itself — the parent /apply page's own server-side check
  // (peekPublicSession) picks up that cookie on the automatic post-action
  // refresh and routes to /apply/verify, which has its own "get a
  // verification link" control. No need to juggle a transient token-display
  // view here; that page is already the single source of truth for it.
  return (
    <Card className="w-full max-w-md">
      <CardContent className="pt-6 space-y-3.5">
        <form action={registerFormAction} className="space-y-3.5">
          <input type="hidden" name="accountType" value={accountType} />
          <input type="hidden" name="preferredLanguage" value={locale} />
          <input type="hidden" name="timeZone" value="Europe/Tirane" />
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">{t("apply.username")}</Label>
            <Input id="username" name="username" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">{t("apply.country")}</Label>
            <Input id="country" name="country" required defaultValue="Albania" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("auth.passwordLabel")}</Label>
            <Input id="password" name="password" type="password" required minLength={8} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t("apply.confirmPassword")}</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
          </div>
          <label className="flex items-start gap-2 text-xs text-ink-muted">
            <input type="checkbox" name="termsAccepted" value="true" required className="mt-0.5 accent-gold" />
            {t("apply.acceptTerms")}
          </label>
          <label className="flex items-start gap-2 text-xs text-ink-muted">
            <input type="checkbox" name="privacyAccepted" value="true" required className="mt-0.5 accent-gold" />
            {t("apply.acceptPrivacy")}
          </label>
          {registerState && "error" in registerState && <p className="text-xs text-danger">{registerState.error}</p>}
          <Button type="submit" disabled={registerPending} className="w-full">
            {registerPending ? t("common.creating") : t("apply.createAccount")}
          </Button>
        </form>
        <button type="button" onClick={() => setView("select")} className="w-full text-center text-xs text-ink-faint hover:text-ink-muted">
          {t("common.back")}
        </button>
      </CardContent>
    </Card>
  );
}
