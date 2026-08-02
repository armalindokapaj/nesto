import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NestoLogo } from "@/components/branding/NestoLogo";
import { getT } from "@/lib/i18n/server";

// Professional/contractor sign-up (the "Construction Passport" identity layer,
// PRD Section 6 & 10) is Phase 4 in the delivery roadmap — this route exists
// so the landing page's link resolves to something real rather than a dead
// link, and states that plainly instead of faking a working form.
export default async function ApplyPage() {
  const { t } = await getT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-6 text-center">
      <NestoLogo size={28} />
      <div className="max-w-md">
        <h1 className="font-serif text-2xl text-ink">{t("apply.title")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t("apply.body")}</p>
      </div>
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:underline">
        <ArrowLeft size={14} /> {t("apply.backToSignIn")}
      </Link>
    </div>
  );
}
