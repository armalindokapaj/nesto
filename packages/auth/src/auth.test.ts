import { describe, it, expect, beforeAll } from "vitest";
import { hashPassword, verifyPassword, needsRehash, burnVerificationTime } from "./password";
import { generateTotpSecret, currentTotp, verifyTotp, totpUri, generateRecoveryCodes } from "./totp";
import {
  issueAccessToken, readAccessToken, issueRefreshToken, refreshTokenMatches,
  isRecentlyAuthenticated, refreshCookieOptions,
} from "./tokens";

beforeAll(() => {
  process.env["AUTH_ACCESS_SECRET"] = "test-access-secret-of-sufficient-length-0123456789";
  process.env["AUTH_REFRESH_PEPPER"] = "test-refresh-pepper-of-sufficient-length-01234567";
});

describe("passwords", () => {
  it("hashes and verifies with argon2id", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("salts, so the same password never produces the same hash", async () => {
    expect(await hashPassword("same password here")).not.toBe(await hashPassword("same password here"));
  });

  it("refuses a password shorter than the policy minimum", async () => {
    await expect(hashPassword("short")).rejects.toThrow(/at least 12/);
  });

  it("treats a corrupted hash as a failed verification, not an exception", async () => {
    // A damaged row must not become a 500 that tells an attacker this account
    // is interesting.
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("flags a hash made with weaker parameters for upgrade", () => {
    expect(needsRehash("$argon2id$v=19$m=4096,t=1,p=1$abc$def")).toBe(true);
    expect(needsRehash("$argon2id$v=19$m=19456,t=2,p=1$abc$def")).toBe(false);
    expect(needsRehash("$2b$10$bcrypthash")).toBe(true);
  });

  it("burns comparable time for an account that does not exist", async () => {
    // Returning early on an unknown email is a user-enumeration oracle that no
    // amount of generic messaging hides.
    const started = Date.now();
    await burnVerificationTime();
    expect(Date.now() - started).toBeGreaterThan(5);
  });
});

describe("TOTP", () => {
  it("accepts the code for the current step", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, currentTotp(secret)).valid).toBe(true);
  });

  it("matches the RFC 6238 test vector", () => {
    // Secret "12345678901234567890" in base32, at T=59 → the published value.
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(currentTotp(secret, new Date(59 * 1000))).toBe("287082");
  });

  it("tolerates one step of clock drift and no more", () => {
    const secret = generateTotpSecret();
    const now = new Date();
    const code = currentTotp(secret, now);
    expect(verifyTotp(secret, code, { at: new Date(now.getTime() + 30_000) }).valid).toBe(true);
    expect(verifyTotp(secret, code, { at: new Date(now.getTime() + 90_000) }).valid).toBe(false);
  });

  it("refuses to reuse a code inside its own window", () => {
    // A code stays valid for a whole 30-second step; without a replay guard a
    // captured code works twice.
    const secret = generateTotpSecret();
    const now = new Date();
    const first = verifyTotp(secret, currentTotp(secret, now), { at: now });
    expect(first.valid).toBe(true);
    const replay = verifyTotp(secret, currentTotp(secret, now), { at: now, lastUsedCounter: first.counter });
    expect(replay.valid).toBe(false);
  });

  it("rejects anything that is not six digits", () => {
    const secret = generateTotpSecret();
    for (const bad of ["12345", "1234567", "abcdef", ""]) {
      expect(verifyTotp(secret, bad).valid).toBe(false);
    }
  });

  it("builds a scannable otpauth uri", () => {
    const uri = totpUri("JBSWY3DPEHPK3PXP", "owner@example.com");
    expect(uri).toContain("otpauth://totp/Nesto%3Aowner%40example.com");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("digits=6");
  });

  it("mints ten distinct recovery codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
  });
});

describe("access tokens", () => {
  it("round-trips claims", async () => {
    const token = await issueAccessToken({
      sub: "u1", sessionId: "s1", audience: "COMPANY", securityStamp: "st1", tenantId: "t1", companyId: "c1",
    });
    const claims = await readAccessToken(token, "COMPANY");
    expect(claims?.sub).toBe("u1");
    expect(claims?.securityStamp).toBe("st1");
  });

  it("carries no role and no permissions", async () => {
    // Authority is resolved live per request. A role in a token is a stale role
    // waiting to happen.
    const token = await issueAccessToken({ sub: "u1", sessionId: "s1", audience: "COMPANY", securityStamp: "st1" });
    const payload = JSON.parse(Buffer.from(token.split(".")[1] as string, "base64url").toString());
    expect(payload).not.toHaveProperty("role");
    expect(payload).not.toHaveProperty("permissions");
    expect(payload).not.toHaveProperty("scopes");
  });

  it("cannot be replayed against another audience", async () => {
    const token = await issueAccessToken({ sub: "u1", sessionId: "s1", audience: "COMPANY", securityStamp: "st1" });
    expect(await readAccessToken(token, "PLATFORM")).toBeNull();
    expect(await readAccessToken(token, "EXTERNAL_PORTAL")).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const token = await issueAccessToken({ sub: "u1", sessionId: "s1", audience: "COMPANY", securityStamp: "st1" });
    expect(await readAccessToken(token.slice(0, -4) + "AAAA", "COMPANY")).toBeNull();
  });

  it("expires in ten minutes, not hours", async () => {
    const token = await issueAccessToken({ sub: "u1", sessionId: "s1", audience: "COMPANY", securityStamp: "st1" });
    const payload = JSON.parse(Buffer.from(token.split(".")[1] as string, "base64url").toString());
    expect(payload.exp - payload.iat).toBe(600);
  });
});

describe("refresh tokens", () => {
  it("stores only a hash and still recognises the token", () => {
    const { token, hash } = issueRefreshToken();
    expect(hash).not.toContain(token);
    expect(refreshTokenMatches(token, hash)).toBe(true);
    expect(refreshTokenMatches("other", hash)).toBe(false);
  });

  it("mints a distinct token every time", () => {
    expect(issueRefreshToken().token).not.toBe(issueRefreshToken().token);
  });

  it("gives each audience its own cookie name and path", () => {
    // A platform cookie is never sent to a company route, so a compromised
    // company page cannot borrow the platform session.
    expect(refreshCookieOptions("COMPANY").path).toBe("/");
    expect(refreshCookieOptions("PLATFORM").path).toBe("/platform");
    expect(refreshCookieOptions("EXTERNAL_PORTAL").path).toBe("/external");
    expect(refreshCookieOptions("PLATFORM").name).not.toBe(refreshCookieOptions("COMPANY").name);
    expect(refreshCookieOptions("COMPANY").httpOnly).toBe(true);
  });
});

describe("recent authentication", () => {
  it("holds for ten minutes after a strong authentication", () => {
    const now = new Date("2026-09-04T12:00:00Z");
    expect(isRecentlyAuthenticated(new Date("2026-09-04T11:55:00Z"), now)).toBe(true);
    expect(isRecentlyAuthenticated(new Date("2026-09-04T11:45:00Z"), now)).toBe(false);
    expect(isRecentlyAuthenticated(null, now)).toBe(false);
  });
});
