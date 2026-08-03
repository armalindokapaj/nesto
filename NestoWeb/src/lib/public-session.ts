import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// PRD_6 §2/§26 — public applicants are not company members, so they get
// their own session cookie and JWT payload shape, entirely separate from
// the tenant-scoped session in lib/session.ts. This is the mechanical half
// of "public profile data and private company data must remain separated" —
// there is no code path where a public session can be read as a tenant
// session or vice versa.

const PUBLIC_SESSION_COOKIE = "nesto_public_session";
const PUBLIC_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export type PublicSessionPayload = {
  publicAccountId: string;
  expiresAt: number;
};

export async function encryptPublicSession(payload: PublicSessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(payload.expiresAt / 1000))
    .sign(secretKey());
}

export async function decryptPublicSession(token: string | undefined): Promise<PublicSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload as unknown as PublicSessionPayload;
  } catch {
    return null;
  }
}

export async function createPublicSession(publicAccountId: string) {
  const expiresAt = Date.now() + PUBLIC_SESSION_DURATION_MS;
  const token = await encryptPublicSession({ publicAccountId, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set(PUBLIC_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });
}

export async function readPublicSessionCookie(): Promise<PublicSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PUBLIC_SESSION_COOKIE)?.value;
  return decryptPublicSession(token);
}

export async function deletePublicSession() {
  const cookieStore = await cookies();
  cookieStore.delete(PUBLIC_SESSION_COOKIE);
}

export const PUBLIC_SESSION_COOKIE_NAME = PUBLIC_SESSION_COOKIE;
