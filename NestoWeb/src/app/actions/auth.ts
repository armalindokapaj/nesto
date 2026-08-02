"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
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

  const user = await db.userIdentity.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });

  // Constant-shape response whether the user exists or not, to avoid
  // leaking account existence via timing/response differences.
  const passwordHash = user?.passwordHash ?? "$2b$10$invalidsaltinvalidsaltinvalidsaltinvalidsal";
  const passwordValid = await bcrypt.compare(password, passwordHash);

  if (!user || !passwordValid) {
    return { error: t("auth.invalidCredentials") };
  }

  const membership = await db.companyMembership.findFirst({
    where: { userId: user.id, accessMode: { in: ["STANDARD", "VIEW_ONLY"] } },
    orderBy: { createdAt: "asc" },
  });

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
