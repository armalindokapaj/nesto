import Link from "next/link";
import { ArrowLeft, Building2, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { NestoLogo } from "@/components/branding/NestoLogo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";

const SECTIONS = [
  { icon: Building2, titleKey: "isolationTitle", bodyKey: "isolationBody" } as const,
  { icon: KeyRound, titleKey: "authTitle", bodyKey: "authBody" } as const,
  { icon: Lock, titleKey: "accessTitle", bodyKey: "accessBody" } as const,
  { icon: ShieldCheck, titleKey: "permissionsTitle", bodyKey: "permissionsBody" } as const,
];

export default async function SecurityPage() {
  const { t } = await getT();
  return (
    <div className="min-h-screen bg-canvas px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <NestoLogo size={28} />
          <h1 className="font-serif text-2xl text-ink">{t("securityPage.title")}</h1>
          <p className="text-sm leading-relaxed text-ink-muted">{t("securityPage.intro")}</p>
        </div>

        <div className="mt-8 space-y-3">
          {SECTIONS.map(({ icon: Icon, titleKey, bodyKey }) => (
            <Card key={titleKey}>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <Icon size={16} className="text-gold shrink-0" />
                  <CardTitle>{t(`securityPage.${titleKey}`)}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm leading-relaxed text-ink-muted">{t(`securityPage.${bodyKey}`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:underline">
            <ArrowLeft size={14} /> {t("securityPage.backToSignIn")}
          </Link>
        </div>
      </div>
    </div>
  );
}
