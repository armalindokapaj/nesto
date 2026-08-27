import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import { isLoginLocked, checkLoginLockout, recordLoginAttempt } from "@/lib/rate-limit";
import { assertAllowedUpload, contentDisagreesWithType, IMAGE_MIME_TYPES, DOCUMENT_MIME_TYPES } from "@/lib/uploads";

// Phase 3 — login() and authenticatePublicAccount() already avoided account
// enumeration (both compare against a dummy hash when no user matches), but
// nothing limited how many times someone could try.
describe("auth hardening", () => {
  const id = () => `probe-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
  let identifier: string;

  beforeEach(() => {
    identifier = id();
  });

  afterAll(async () => {
    await db.loginAttempt.deleteMany({ where: { identifier: { startsWith: "probe-" } } }).catch(() => {});
  });

  describe("login lockout", () => {
    it("allows the first attempts and counts down", async () => {
      expect(await isLoginLocked(identifier)).toBe(false);
      await recordLoginAttempt(identifier, false);
      expect(await checkLoginLockout(identifier)).toEqual({ locked: false, remaining: 4 });
    });

    it("locks on the sixth attempt after five failures", async () => {
      for (let i = 0; i < 4; i++) await recordLoginAttempt(identifier, false);
      expect(await isLoginLocked(identifier)).toBe(false);
      await recordLoginAttempt(identifier, false);
      // Five recorded failures means the sixth attempt is refused.
      expect(await isLoginLocked(identifier)).toBe(true);
    });

    it("clears the counter on a successful login", async () => {
      for (let i = 0; i < 5; i++) await recordLoginAttempt(identifier, false);
      expect(await isLoginLocked(identifier)).toBe(true);
      await recordLoginAttempt(identifier, true);
      // Someone who mistyped and then got it right is not punished for the
      // rest of the window.
      expect(await isLoginLocked(identifier)).toBe(false);
    });

    it("counts each identifier separately", async () => {
      const other = id();
      for (let i = 0; i < 5; i++) await recordLoginAttempt(identifier, false);
      expect(await isLoginLocked(identifier)).toBe(true);
      expect(await isLoginLocked(other)).toBe(false);
    });

    it("ignores failures older than the window", async () => {
      const old = new Date(Date.now() - 60 * 60 * 1000);
      await db.loginAttempt.createMany({
        data: Array.from({ length: 8 }, () => ({ identifier, succeeded: false, createdAt: old })),
      });
      expect(await isLoginLocked(identifier)).toBe(false);
    });

    // The counter is keyed on the identifier as typed, never on a resolved
    // user — which is what keeps the lockout message non-enumerating: an
    // invented address locks out and reads exactly like a real one.
    it("locks an identifier that matches no account at all", async () => {
      const nobody = `probe-nobody-${Date.now()}@nowhere.invalid`;
      for (let i = 0; i < 5; i++) await recordLoginAttempt(nobody, false);
      expect(await isLoginLocked(nobody)).toBe(true);
      await db.loginAttempt.deleteMany({ where: { identifier: nobody } });
    });
  });

  describe("upload validation", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

    it("accepts a real image of an allowed type", () => {
      expect(() => assertAllowedUpload(png, "image/png", IMAGE_MIME_TYPES)).not.toThrow();
      expect(() => assertAllowedUpload(jpeg, "image/jpeg", IMAGE_MIME_TYPES)).not.toThrow();
    });

    it("rejects a type that is not on the list", () => {
      expect(() => assertAllowedUpload(pdf, "application/pdf", IMAGE_MIME_TYPES)).toThrow(/not accepted/i);
      // ...but the same file is fine where PDFs belong.
      expect(() => assertAllowedUpload(pdf, "application/pdf", DOCUMENT_MIME_TYPES)).not.toThrow();
    });

    // The whole point: the declared type is attacker-controlled, so an
    // allowlist over it alone only catches honest mistakes.
    it("rejects a file whose bytes contradict its declared type", () => {
      const script = new Uint8Array([0x3c, 0x3f, 0x70, 0x68, 0x70]); // "<?php"
      expect(contentDisagreesWithType(script, "image/png")).toBe(true);
      expect(() => assertAllowedUpload(script, "image/png", IMAGE_MIME_TYPES)).toThrow(/does not match its declared type/i);
    });

    it("does not reject formats that have no reliable signature", () => {
      // CSV/plain text/OOXML cannot be sniffed this way, so they pass on the
      // allowlist alone rather than failing a check that cannot see them.
      const csv = new Uint8Array([0x61, 0x2c, 0x62, 0x0a]);
      expect(contentDisagreesWithType(csv, "text/csv")).toBe(false);
      expect(() => assertAllowedUpload(csv, "text/csv", DOCUMENT_MIME_TYPES)).not.toThrow();
    });

    it("catches a truncated file too short to carry its own signature", () => {
      expect(contentDisagreesWithType(new Uint8Array([0x89]), "image/png")).toBe(true);
    });
  });
});
