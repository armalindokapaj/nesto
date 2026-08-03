import Link from "next/link";
import { ArrowLeft, Mail, PlayCircle, ShieldCheck } from "lucide-react";
import { NestoLogo } from "@/components/branding/NestoLogo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";

export default async function ContactPage() {
  const { t } = await getT();
  const email = t("help.contactEmail");

  return (
    <div className="min-h-screen bg-canvas px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <NestoLogo size={28} />
          <h1 className="font-serif text-2xl text-ink">{t("contactPage.title")}</h1>
          <p className="text-sm leading-relaxed text-ink-muted">{t("contactPage.intro")}</p>
        </div>

        <div className="mt-8 space-y-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <Mail size={16} className="text-gold shrink-0" />
                <CardTitle>{t("contactPage.supportTitle")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-relaxed text-ink-muted">{t("contactPage.supportBody")}</p>
              <a href={`mailto:${email}`} className="mt-2 inline-block text-sm font-medium text-gold hover:underline">
                {email}
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <PlayCircle size={16} className="text-gold shrink-0" />
                <CardTitle>{t("contactPage.salesTitle")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-relaxed text-ink-muted">{t("contactPage.salesBody")}</p>
              <Link href="/request-demo" className="mt-2 inline-block text-sm font-medium text-gold hover:underline">
                {t("contactPage.salesLink")}
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={16} className="text-gold shrink-0" />
                <CardTitle>{t("contactPage.securityTitle")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-relaxed text-ink-muted">{t("contactPage.securityBody")}</p>
              <Link href="/security" className="mt-2 inline-block text-sm font-medium text-gold hover:underline">
                {t("contactPage.securityLink")}
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:underline">
            <ArrowLeft size={14} /> {t("contactPage.backToSignIn")}
          </Link>
        </div>
      </div>
    </div>
  );
}
