"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { ROLES, ASSIGNABLE_ACCESS_MODES } from "@/lib/constants";
import { setMemberAccessMode } from "@/server/admin";
import { logAudit } from "@/lib/audit";
import { toActionError } from "@/lib/errors";

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

// Audit H7 — Math.random() is not a CSPRNG and must never generate secrets.
// crypto.randomInt() is backed by the OS's cryptographically secure RNG and
// (unlike a naive `Math.random() * n`) has no modulo bias.
function generateTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[randomInt(chars.length)];
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

  // Audit C3 — Admin has the same FULL_ADMIN permission matrix as Owner, but
  // must never be able to mint another Owner-level account. Only an existing
  // Owner can create one. Owner transfer/succession is a separate, not-yet-
  // built formal workflow, not something that should fall out of this form.
  if (role === "OWNER" && actorRole !== "OWNER") {
    return { error: "Only the Company Owner can grant Owner-level access." };
  }

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

// Phase 18 — Access Revocation. Suspend / archive / restore a member.
export async function setMemberAccessModeAction(
  targetUserId: string,
  mode: string,
  reason?: string,
): Promise<{ error: string } | { success: true }> {
  const { tenantId, role: actorRole, user: actor } = await getCurrentUser();

  if (!can(actorRole, "USER_MANAGEMENT", "FULL")) {
    return { error: "You do not have permission to change member access." };
  }

  const parsed = z.enum(ASSIGNABLE_ACCESS_MODES).safeParse(mode);
  if (!parsed.success) return { error: "Unknown access mode." };

  try {
    await setMemberAccessMode(tenantId, { id: actor.id, role: actorRole }, targetUserId, parsed.data, reason);
  } catch (err) {
    return { error: toActionError(err, "Could not change access.") };
  }

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/users");
  return { success: true };
}

// Phase 1 Track D — manual retry for a stuck domain event. dispatchDomainEvents
// already skips anything PROCESSED and re-runs the rest, so it is the retry
// primitive; this only adds the permission gate and the audit trail.
export async function retryDomainEventAction(eventId: string): Promise<{ error: string } | { success: true }> {
  const { tenantId, role: actorRole, user: actor } = await getCurrentUser();
  if (!can(actorRole, "AUDIT_LOGS", "READ") || !can(actorRole, "USER_MANAGEMENT", "FULL")) {
    return { error: "You do not have permission to retry domain events." };
  }
  const event = await db.domainEvent.findUnique({ where: { id: eventId } });
  if (!event || event.tenantId !== tenantId) return { error: "Event not found." };
  if (event.status === "PROCESSED") return { error: "This event has already been processed." };

  const { dispatchDomainEvents } = await import("@/lib/domain-events");
  await dispatchDomainEvents([eventId]);

  const after = await db.domainEvent.findUnique({ where: { id: eventId } });
  await logAudit({
    tenantId, actorId: actor.id, action: "domain_event.retried",
    targetType: "DomainEvent", targetId: eventId,
    metadata: { type: event.type, resultStatus: after?.status ?? "UNKNOWN" },
  });

  revalidatePath("/dashboard/admin/domain-events");
  if (after?.status === "FAILED") return { error: after.error ?? "The retry failed again." };
  return { success: true };
}
