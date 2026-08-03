import { NestoLogo } from "@/components/branding/NestoLogo";
import { AboutMenu } from "@/components/marketing/about-menu";
import { AuthCard } from "@/components/marketing/auth-card";
import { BlueprintMotif } from "@/components/marketing/blueprint-motif";
import { HighlightedLine } from "@/components/marketing/highlighted-line";
import { getT } from "@/lib/i18n/server";

export default async function LandingPage() {
  const { t } = await getT();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-canvas">
      <BlueprintMotif className="pointer-events-none absolute -bottom-16 -left-16 h-[420px] w-[420px] text-ink/[0.06]" />

      <header className="relative z-10 flex shrink-0 items-center justify-between px-6 md:px-10 h-14">
        <NestoLogo size={24} />
        <AboutMenu />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-4">
        <h1 className="text-center text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
          <HighlightedLine text={t("landing.headlineLine1")} />
        </h1>

        <div className="mt-3">
          <AuthCard />
        </div>

        <div className="mt-6 max-w-[380px] text-center">
          <p className="font-serif text-xl leading-snug text-ink">
            <HighlightedLine text={t("landing.headline")} />
          </p>
          <div className="mt-2 h-px w-10 bg-gold mx-auto" />
          <p className="mt-2 text-sm text-ink-muted">{t("landing.tagline")}</p>
        </div>
      </main>
    </div>
  );
}
