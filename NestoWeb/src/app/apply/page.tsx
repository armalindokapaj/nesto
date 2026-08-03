import { redirect } from "next/navigation";
import { peekPublicSession } from "@/lib/public-dal";
import { db } from "@/lib/db";
import { NestoLogo } from "@/components/branding/NestoLogo";
import { ApplyEntry } from "@/components/apply/apply-entry";
import { getT } from "@/lib/i18n/server";

// PRD_6 — replaces the old "this isn't open yet" placeholder with the real
// public registration entry point. If the visitor already has a public
// session, route them straight to wherever their application actually is
// instead of showing the pitch screen again.
export default async function ApplyPage() {
  const session = await peekPublicSession();
  if (session) {
    const account = await db.publicAccount.findUnique({ where: { id: session.publicAccountId } });
    if (account) {
      if (!account.emailVerified) redirect("/apply/verify");
      if (account.status === "PROFILE_INCOMPLETE" || account.status === "READY_TO_SUBMIT" || account.status === "CHANGES_REQUESTED") {
        redirect("/apply/onboarding");
      }
      redirect("/apply/pending");
    }
  }

  const { t } = await getT();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-canvas px-6 py-12">
      <NestoLogo size={28} />
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl text-ink">{t("apply.heading")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t("apply.supportingText")}</p>
      </div>
      <ApplyEntry />
    </div>
  );
}
