"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isLoginLocked, recordLoginAttempt } from "@/lib/rate-limit";
import { createSession, deleteSession } from "@/lib/session";
import { DASHBOARD_BY_ROLE } from "@/lib/permissions";
import type { Role } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";

const LoginSchema = z.object({
  identifier: z.string().min(1, "Enter your company email or username"),
  password: z.string().min(1, "Enter your password"),
});

export type LoginState = {
  error?: string;
} | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const { t } = await getT();

  const parsed = LoginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { identifier, password } = parsed.data;

  // Phase 3 Track A — the constant-shape comparison below stops account
  // enumeration but never limited how many times someone could try.
  //
  // The lockout message is deliberately more informative than "invalid
  // credentials", which the PRD left as a choice to make on purpose. It does
  // not enumerate: the counter is keyed on the identifier as typed, so an
  // invented account locks out and reads exactly the same as a real one. These
  // accounts are admin-provisioned internal ones, and a locked-out employee who
  // cannot tell why is a real cost with nothing bought in exchange.
  // Every statement this action runs is sub-millisecond on the server — the
  // tables involved are small and indexed. What signing in actually costs is
  // round trips to a database a continent away (~130ms each, and far worse
  // under jitter), so the only number worth tuning is how many of them happen
  // in series. This is deliberately two stages: everything knowable before the
  // password is checked, then the attempt record.
  const [locked, user] = await Promise.all([
    isLoginLocked(identifier),
    db.userIdentity.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      // The workspace is joined in here rather than looked up after the
      // password check. It rides along in the same round trip, and on the
      // failure path the extra row is simply discarded.
      relationLoadStrategy: "join",
      select: {
        id: true,
        passwordHash: true,
        memberships: {
          where: { accessMode: { in: ["STANDARD", "VIEW_ONLY"] } },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { tenantId: true, role: true },
        },
      },
    }),
  ]);

  if (locked) {
    return { error: t("auth.tooManyAttempts") };
  }

  // Constant-shape response whether the user exists or not, to avoid
  // leaking account existence via timing/response differences. Issuing the
  // lookup above unconditionally rather than skipping it when locked keeps
  // that property intact — it is one read whose result is thrown away.
  const passwordHash = user?.passwordHash ?? "$2b$10$invalidsaltinvalidsaltinvalidsaltinvalidsal";
  const passwordValid = await bcrypt.compare(password, passwordHash);

  await recordLoginAttempt(identifier, Boolean(user && passwordValid));

  if (!user || !passwordValid) {
    return { error: t("auth.invalidCredentials") };
  }

  const membership = user.memberships[0];

  if (!membership) {
    return { error: t("auth.noWorkspace") };
  }

  await createSession(user.id, membership.tenantId, membership.role as Role);
  redirect(DASHBOARD_BY_ROLE[membership.role as Role] ?? "/dashboard/executive");
}

export async function logout() {
  await deleteSession();
  redirect("/");
}

const ForgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export type ForgotPasswordState = { error: string } | { success: true } | undefined;

// Accounts are admin-provisioned (AUT-001) — there is no self-service reset
// flow, so the useful action here is notifying the requester's own workspace
// admin(s), not emailing a reset link. Same constant-shape-response
// discipline as login(): we do the lookup either way and always return the
// same success shape, so this can't be used to enumerate registered emails.
export async function requestPasswordResetAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = ForgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await db.userIdentity.findUnique({
    where: { email: parsed.data.email },
    include: { memberships: true },
  });

  if (user) {
    const tenantIds = user.memberships.map((m) => m.tenantId);
    const admins = await db.companyMembership.findMany({
      where: { tenantId: { in: tenantIds }, role: { in: ["OWNER", "ADMIN"] } },
    });
    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map((admin) => ({
          tenantId: admin.tenantId,
          userId: admin.userId,
          type: "PASSWORD_RESET_REQUEST",
          title: "Password reset requested",
          body: `${user.displayName} (${user.email}) requested help signing back in.`,
          link: "/company",
        })),
      });
    }
  }

  return { success: true };
}
