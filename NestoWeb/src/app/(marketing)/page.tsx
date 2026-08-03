import { NestoLogo } from "@/components/branding/NestoLogo";
import { AboutMenu } from "@/components/marketing/about-menu";
import { LoginForm } from "@/components/marketing/login-form";
import { BlueprintMotif } from "@/components/marketing/blueprint-motif";
import { HighlightedLine } from "@/components/marketing/highlighted-line";
import { getT } from "@/lib/i18n/server";

export default async function LandingPage() {
  const { t } = await getT();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-canvas">
      <BlueprintMotif className="pointer-events-none absolute -bottom-16 -left-16 h-[420px] w-[420px] text-ink/[0.06]" />

      <header className="relative z-10 flex shrink-0 items-center justify-between px-6 md:px-10 h-16">
        <NestoLogo size={26} />
        <AboutMenu />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-6 pt-6 pb-10 md:pt-8">
        <h1 className="text-center text-sm font-medium uppercase tracking-[0.08em] text-ink-muted">
          <HighlightedLine text={t("landing.headlineLine1")} />
        </h1>

        <div className="mt-6">
          <LoginForm />
        </div>

        <div className="mt-10 max-w-[480px] text-center">
          <p className="font-serif text-2xl leading-[1.25] text-ink sm:text-3xl">
            <HighlightedLine text={t("landing.headlineLine2")} />
            <br />
            <HighlightedLine text={t("landing.headlineLine3")} />
          </p>
          <div className="mt-4 h-px w-12 bg-gold mx-auto" />
          <p className="mt-4 text-[0.9rem] leading-relaxed text-ink-muted">{t("landing.tagline")}</p>
        </div>
      </main>
    </div>
  );
}
