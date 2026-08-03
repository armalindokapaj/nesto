"use client";

import { ArrowLeft, Briefcase, HardHat } from "lucide-react";
import { NestoMark } from "@/components/branding/NestoLogo";
import { useI18n } from "@/lib/i18n/locale-provider";
import type { PublicAccountType } from "@/lib/constants";

// Inner-front face of the landing-page auth card's signup area (nested
// inside the outer card's back — see auth-card.tsx). Choosing Professional
// or Contractor flips the INNER pair to reveal the registration form for
// that type, in place — never a page navigation. "Back to company sign in"
// flips the OUTER pair back to the sign-in face.
export function SignUpFace({
  onSelectType,
  onBack,
}: {
  onSelectType: (type: PublicAccountType) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex h-full flex-col">
      <div className="px-7 pt-6 pb-3 text-center">
        <NestoMark size={28} className="text-gold mx-auto" />
        <h1 className="mt-2 font-serif text-lg text-ink">{t("auth.joinNesto")}</h1>
        <p className="mt-1 text-xs text-ink-muted">{t("auth.joinNestoSubtitle")}</p>
        <div className="mt-2 h-px w-8 bg-gold mx-auto" />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-2.5 px-7">
        <button
          type="button"
          onClick={() => onSelectType("PROFESSIONAL")}
          className="flex items-start gap-2.5 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-gold"
        >
          <Briefcase size={18} className="mt-0.5 shrink-0 text-gold" />
          <span>
            <span className="block font-serif text-sm text-ink">{t("apply.professionalCardTitle")}</span>
            <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{t("apply.professionalCardBody")}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectType("CONTRACTOR")}
          className="flex items-start gap-2.5 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-gold"
        >
          <HardHat size={18} className="mt-0.5 shrink-0 text-gold" />
          <span>
            <span className="block font-serif text-sm text-ink">{t("apply.contractorCardTitle")}</span>
            <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{t("apply.contractorCardBody")}</span>
          </span>
        </button>
      </div>

      <div className="border-t border-border px-7 py-3 text-center">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={12} /> {t("apply.backToCompanySignIn")}
        </button>
      </div>
    </div>
  );
}
