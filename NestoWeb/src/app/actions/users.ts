"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { ROLES } from "@/lib/constants";

const CreateUserSchema = z.object({
  fullName: z.string().min(2, "Enter a full name"),
  username: z.string().min(3, "Username must be at least 3 characters").regex(/^[a-z0-9._-]+$/i, "Letters, numbers, dots, dashes only"),
  email: z.string().email("Enter a valid email"),
  department: z.string().optional(),
  position: z.string().optional(),
  role: z.enum(ROLES),
});

export type CreateUserState =
  | { error: string }
  | { success: true; username: string; temporaryPassword: string }
  | undefined;

function generateTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// AUT-001: only Company Owner/Admin may create internal company accounts.
export async function createUser(_prevState: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const { tenantId, role: actorRole, user: actor } = await getCurrentUser();

  if (!can(actorRole, "USER_MANAGEMENT", "FULL")) {
    return { error: "You do not have permission to create users." };
  }

  const parsed = CreateUserSchema.safeParse({
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    email: formData.get("email"),
    department: formData.get("department") || undefined,
    position: formData.get("position") || undefined,
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { fullName, username, email, department, position, role } = parsed.data;

  const existing = await db.userIdentity.findFirst({ where: { OR: [{ username }, { email }] } });
  if (existing) {
    return { error: "A user with that username or email already exists." };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const newUser = await db.userIdentity.create({
    data: { displayName: fullName, username, email, passwordHash },
  });

  await db.companyMembership.create({
    data: { tenantId, userId: newUser.id, role, department, position, accessMode: "STANDARD" },
  });

  await db.auditEvent.create({
    data: {
      tenantId,
      actorId: actor.id,
      action: "USER_CREATED",
      targetType: "UserIdentity",
      targetId: newUser.id,
      metadata: JSON.stringify({ role, createdBy: actor.displayName }),
    },
  });

  await db.notification.create({
    data: {
      tenantId,
      userId: actor.id,
      type: "USER_CREATED",
      title: "New user created",
      body: `${fullName} was added as ${role}`,
    },
  });

  revalidatePath("/dashboard/admin");

  return { success: true, username, temporaryPassword };
}
