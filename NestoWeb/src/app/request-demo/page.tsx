import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NestoLogo } from "@/components/branding/NestoLogo";
import { getT } from "@/lib/i18n/server";

// Nesto is currently a single pilot-tenant build with no live sales/demo
// pipeline behind it yet — this page says that plainly (same call as
// src/app/apply/page.tsx) rather than presenting a lead form nothing reads.
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
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:underline">
        <ArrowLeft size={14} /> {t("requestDemoPage.backToSignIn")}
      </Link>
    </div>
  );
}
