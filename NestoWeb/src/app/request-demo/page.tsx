import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { NestoLogo } from "@/components/branding/NestoLogo";
import { getT } from "@/lib/i18n/server";

// Nesto is live and taking sign-ups — construction professionals and
// contractors join today via /apply (src/app/apply/page.tsx). Full
// multi-department company workspaces are still provisioned by hand (no
// self-serve tenant/company creation exists yet), so that path is a direct
// contact CTA rather than a form that would only fake self-service.
export default async function RequestDemoPage() {
  const { t } = await getT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-6 text-center">
      <NestoLogo size={28} />
      <div className="max-w-lg">
        <h1 className="font-serif text-2xl text-ink">{t("requestDemoPage.title")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t("requestDemoPage.body")}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t("requestDemoPage.whatItCovers")}</p>
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/apply"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gold-strong transition-colors"
        >
          {t("requestDemoPage.cta")} <ArrowRight size={14} />
        </Link>
        <a
          href={`mailto:${t("help.contactEmail")}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-ink hover:border-border-strong hover:bg-surface-sunken transition-colors"
        >
          <Mail size={14} /> {t("requestDemoPage.contactCta")}
        </a>
      </div>

      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:underline">
        <ArrowLeft size={14} /> {t("requestDemoPage.backToSignIn")}
      </Link>
    </div>
  );
}
