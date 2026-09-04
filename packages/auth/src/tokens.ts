/**
 * Access and refresh tokens — ADR-0003, PRD §7.2.
 *
 * The access token carries identity and a security stamp. It carries **no role
 * and no permissions**, deliberately: a signed token is a claim about who you
 * are, never about what you may do. Authority is read live on every request, so
 * a demotion takes effect immediately instead of when the token expires. This
 * is the single most common way multi-tenant systems leak — a stale role in a
 * JWT that nobody thought of as cached state.
 *
 * The refresh token is opaque and rotating. Presenting one that has already
 * been rotated means it was captured, so the whole family dies.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { generateToken, hashToken, safeEqual } from "@nesto/crypto";
import type { Audience } from "@nesto/contracts";

export const ACCESS_TOKEN_TTL_SECONDS = 600; // 10 minutes
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const RECENT_AUTH_WINDOW_SECONDS = 600;

export type AccessTokenClaims = {
  sub: string;
  sessionId: string;
  audience: Audience;
  securityStamp: string;
  /** Present only in the company audience. A selection, still validated
   *  server-side against live membership on every request (§6.2). */
  tenantId?: string;
  companyId?: string;
  externalOrganizationId?: string;
};

function secret(): Uint8Array {
  const value = process.env["AUTH_ACCESS_SECRET"];
  if (!value || value.length < 32) {
    throw new Error("AUTH_ACCESS_SECRET is missing or shorter than 32 characters.");
  }
  return new TextEncoder().encode(value);
}

export async function issueAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({ ...claims } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer("nesto")
    .setAudience(claims.audience)
    .setSubject(claims.sub)
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret());
}

export async function readAccessToken(token: string, audience: Audience): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "nesto",
      audience,
      algorithms: ["HS256"],
    });
    // Pinning the audience means a company token cannot be replayed against the
    // platform surface, or a portal token against either (§18.3).
    return payload as unknown as AccessTokenClaims;
  } catch {
    return null;
  }
}

export type RefreshTokenPair = { token: string; hash: string };

/** The pepper means a database read alone cannot turn stored hashes into usable
 *  tokens; an attacker needs the application's secret as well. */
function pepper(): string {
  const value = process.env["AUTH_REFRESH_PEPPER"];
  if (!value || value.length < 32) {
    throw new Error("AUTH_REFRESH_PEPPER is missing or shorter than 32 characters.");
  }
  return value;
}

export function issueRefreshToken(): RefreshTokenPair {
  const token = generateToken(32);
  return { token, hash: hashToken(token, pepper()) };
}

export function refreshTokenMatches(presented: string, storedHash: string): boolean {
  return safeEqual(hashToken(presented, pepper()), storedHash);
}

export function refreshExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function isRecentlyAuthenticated(lastStrongAuthAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastStrongAuthAt) return false;
  return now.getTime() - lastStrongAuthAt.getTime() <= RECENT_AUTH_WINDOW_SECONDS * 1000;
}

/**
 * Cookie attributes per audience.
 *
 * Distinct paths are what keep the two audiences apart in the browser: a
 * platform session cookie is never sent to a company route, so a compromised
 * company page cannot borrow it. `SameSite=Lax` plus the origin check in the
 * API is the CSRF pair (§7.2).
 */
export function refreshCookieOptions(audience: Audience): {
  name: string;
  path: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  maxAge: number;
} {
  const map: Record<string, { name: string; path: string }> = {
    COMPANY: { name: "nesto_refresh", path: "/" },
    PLATFORM: { name: "nesto_platform_refresh", path: "/platform" },
    EXTERNAL_PORTAL: { name: "nesto_portal_refresh", path: "/external" },
    PUBLIC: { name: "nesto_public", path: "/" },
  };
  const entry = map[audience] ?? map["COMPANY"]!;
  return {
    name: entry.name,
    path: entry.path,
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  };
}
