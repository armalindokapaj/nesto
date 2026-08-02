import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@/lib/constants";

const SESSION_COOKIE = "nesto_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — SEC-002 inactivity/session policy

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  tenantId: string;
  role: Role;
  expiresAt: number;
};

export async function encryptSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(payload.expiresAt / 1000))
    .sign(secretKey());
}

export async function decryptSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// Creates the session cookie for a freshly authenticated user in a given tenant workspace.
export async function createSession(userId: string, tenantId: string, role: Role) {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const token = await encryptSession({ userId, tenantId, role, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });
}

// Called when a user switches active company workspace (Section 3: workspace switching).
export async function updateSessionTenant(tenantId: string, role: Role) {
  const current = await readSessionCookie();
  if (!current) return;
  await createSession(current.userId, tenantId, role);
}

export async function readSessionCookie(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return decryptSession(token);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
