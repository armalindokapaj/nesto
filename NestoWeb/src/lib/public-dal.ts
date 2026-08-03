import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readPublicSessionCookie } from "@/lib/public-session";
import { db } from "@/lib/db";

// Optimistic, non-redirecting variant — for the /apply landing page, which
// needs to know "is someone already signed up" without forcing a redirect.
export const peekPublicSession = cache(async () => {
  return readPublicSessionCookie();
});

export const verifyPublicSession = cache(async () => {
  const session = await readPublicSessionCookie();
  if (!session?.publicAccountId) {
    redirect("/apply");
  }
  return session;
});

export const getCurrentPublicAccount = cache(async () => {
  const session = await verifyPublicSession();
  const account = await db.publicAccount.findUnique({ where: { id: session.publicAccountId } });
  if (!account) {
    redirect("/apply");
  }
  return account;
});

export type CurrentPublicAccount = Awaited<ReturnType<typeof getCurrentPublicAccount>>;
