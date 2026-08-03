import { redirect } from "next/navigation";
import { verifyEmail } from "@/server/public-signup";
import { peekPublicSession } from "@/lib/public-dal";
import { NestoLogo } from "@/components/branding/NestoLogo";
import { ResendVerification } from "@/components/apply/resend-verification";
import { getT } from "@/lib/i18n/server";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const { t } = await getT();

  if (token) {
    try {
      await verifyEmail(token);
    } catch {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
          <NestoLogo size={28} />
          <p className="text-sm text-danger">{t("apply.verifyLinkInvalid")}</p>
          <ResendVerification />
        </div>
      );
    }
    redirect("/apply/onboarding");
  }

  const session = await peekPublicSession();
  if (!session) redirect("/apply");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <NestoLogo size={28} />
      <h1 className="font-serif text-xl text-ink">{t("apply.verifyEmailTitle")}</h1>
      <p className="max-w-sm text-sm text-ink-muted">{t("apply.verifyEmailNoProviderNote")}</p>
      <ResendVerification />
    </div>
  );
}
