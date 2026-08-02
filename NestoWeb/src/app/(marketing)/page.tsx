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

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-start gap-10 px-6 pt-6 pb-6 md:flex-row md:justify-between md:items-start md:gap-10 md:pt-12">
        <div className="max-w-[480px] text-center md:text-left">
          <h1 className="font-serif text-4xl leading-[1.15] text-ink sm:text-5xl">
            <HighlightedLine text={t("landing.headlineLine1")} />
            <br />
            <HighlightedLine text={t("landing.headlineLine2")} />
            <br />
            <HighlightedLine text={t("landing.headlineLine3")} />
          </h1>
          <div className="mt-5 h-px w-12 bg-gold mx-auto md:mx-0" />
          <p className="mt-5 text-[0.95rem] leading-relaxed text-ink-muted">{t("landing.tagline")}</p>
        </div>

        <LoginForm />
      </main>
    </div>
  );
}
