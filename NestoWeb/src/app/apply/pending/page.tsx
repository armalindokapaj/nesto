import { redirect } from "next/navigation";
import { getCurrentPublicAccount } from "@/lib/public-dal";
import { getPublicAccountFull, computeCompletion } from "@/server/public-signup";
import { PendingDashboard } from "@/components/apply/pending-dashboard";

export default async function PendingPage() {
  const session = await getCurrentPublicAccount();
  if (!session.emailVerified) redirect("/apply/verify");

  const account = await getPublicAccountFull(session.id);
  if (!account) redirect("/apply");
  const completion = await computeCompletion(session.id);

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <PendingDashboard account={account} completion={completion} />
      </div>
    </div>
  );
}
