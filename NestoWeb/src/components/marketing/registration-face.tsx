"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Briefcase, HardHat } from "lucide-react";
import { registerAction } from "@/app/actions/public-signup";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NestoMark } from "@/components/branding/NestoLogo";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { PublicAccountType } from "@/lib/constants";

// Inner-back face of the landing-page auth card's signup area — the actual
// registerAction form (src/app/actions/public-signup.ts), same schema the
// standalone /apply page's "register" view uses, but compact enough to fit
// the fixed 350x480 card and reachable without ever leaving it. Content
// depends on `applicantType` (set by sign-up-face.tsx's choice); "Back"
// flips the inner pair back to that choice, not out to sign-in.
export function RegistrationFace({
  applicantType,
  onBack,
}: {
  applicantType: PublicAccountType;
  onBack: () => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(registerAction, undefined);
  const isSuccess = !!state && "success" in state;
  const Icon = applicantType === "PROFESSIONAL" ? Briefcase : HardHat;
  const title = applicantType === "PROFESSIONAL" ? t("apply.professionalCardTitle") : t("apply.contractorCardTitle");

  // Registration itself never leaves the card, but a *created* account
  // genuinely has somewhere to go next (email verification) — this is the
  // one deliberate exception, and only fires once, after success.
  useEffect(() => {
    if (isSuccess) router.push("/apply/verify");
  }, [isSuccess, router]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-7 pt-5 pb-2 text-center shrink-0">
        <NestoMark size={24} className="text-gold mx-auto" />
        <div className="mt-1.5 flex items-center justify-center gap-1.5">
          <Icon size={14} className="text-gold" />
          <h1 className="font-serif text-base text-ink">{title}</h1>
        </div>
        <div className="mt-2 h-px w-8 bg-gold mx-auto" />
      </div>

      <form action={formAction} className="flex-1 min-h-0 overflow-y-auto px-7 py-2 space-y-2">
        <input type="hidden" name="accountType" value={applicantType} />
        <input type="hidden" name="preferredLanguage" value={locale} />
        <input type="hidden" name="timeZone" value="Europe/Tirane" />

        <Input name="email" type="email" placeholder={t("common.email")} required className="h-8 text-xs" />
        <Input name="username" placeholder={t("apply.username")} required className="h-8 text-xs" />
        <Input name="country" placeholder={t("apply.country")} required defaultValue="Albania" className="h-8 text-xs" />
        <Input name="password" type="password" placeholder={t("auth.passwordLabel")} required minLength={8} className="h-8 text-xs" />
        <Input name="confirmPassword" type="password" placeholder={t("apply.confirmPassword")} required minLength={8} className="h-8 text-xs" />

        <label className="flex items-start gap-1.5 text-[0.65rem] leading-snug text-ink-muted">
          <input type="checkbox" name="termsAccepted" value="true" required className="mt-0.5 accent-gold" />
          {t("apply.acceptTerms")}
        </label>
        <label className="flex items-start gap-1.5 text-[0.65rem] leading-snug text-ink-muted">
          <input type="checkbox" name="privacyAccepted" value="true" required className="mt-0.5 accent-gold" />
          {t("apply.acceptPrivacy")}
        </label>

        <div className="flex min-h-6 items-center justify-center">
          {state && "error" in state && (
            <p className="premium-pop-in rounded-full border border-danger/25 bg-danger-soft px-2.5 py-1 text-[0.7rem] text-danger">
              {state.error}
            </p>
          )}
        </div>

        <Button type="submit" disabled={pending || isSuccess} className="w-full" size="md">
          {pending || isSuccess ? t("common.creating") : t("apply.createAccount")}
        </Button>
      </form>

      <div className="border-t border-border px-7 py-3 text-center shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={12} /> {t("common.back")}
        </button>
      </div>
    </div>
  );
}
