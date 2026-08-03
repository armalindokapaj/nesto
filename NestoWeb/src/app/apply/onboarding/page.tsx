import { redirect } from "next/navigation";
import { getCurrentPublicAccount } from "@/lib/public-dal";
import { getPublicAccountFull, computeCompletion } from "@/server/public-signup";
import { OnboardingWizard } from "@/components/apply/onboarding-wizard";

// PRD_6 §12.4 — editing stays allowed through CHANGES_REQUESTED/RESUBMITTED
// too, only truly-decided states (APPROVED*, REJECTED, SUSPENDED,
// DEACTIVATED) send the applicant to the read-only pending dashboard instead.
const EDITABLE_STATUSES = ["PROFILE_INCOMPLETE", "READY_TO_SUBMIT", "CHANGES_REQUESTED", "RESUBMITTED"];

export default async function OnboardingPage() {
  const session = await getCurrentPublicAccount();
  if (!session.emailVerified) redirect("/apply/verify");
  if (!EDITABLE_STATUSES.includes(session.status)) redirect("/apply/pending");

  const account = await getPublicAccountFull(session.id);
  if (!account) redirect("/apply");
  const completion = await computeCompletion(session.id);

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <OnboardingWizard account={account} completion={completion} />
      </div>
    </div>
  );
}
