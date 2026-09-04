import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { Encryptor, hashToken, safeEqual, generateToken, opaqueExternalId, chainHash } from "./index";

const KEK = randomBytes(32).toString("base64");

describe("Encryptor", () => {
  it("round-trips a secret", () => {
    const e = new Encryptor(KEK);
    const ct = e.encrypt("JBSWY3DPEHPK3PXP");
    expect(e.decrypt(ct)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("produces a different blob every time, so equal secrets are not linkable", () => {
    const e = new Encryptor(KEK);
    expect(e.encrypt("same").blob).not.toBe(e.encrypt("same").blob);
  });

  it("refuses a tampered payload rather than returning garbage", () => {
    const e = new Encryptor(KEK);
    const ct = e.encrypt("secret");
    const raw = Buffer.from(ct.blob, "base64");
    raw[raw.length - 1] ^= 0xff;
    expect(() => e.decrypt({ ...ct, blob: raw.toString("base64") })).toThrow();
  });

  it("cannot be opened with a different KEK", () => {
    const ct = new Encryptor(KEK).encrypt("secret");
    expect(() => new Encryptor(randomBytes(32).toString("base64")).decrypt(ct)).toThrow();
  });

  it("rejects a KEK that is not 32 bytes", () => {
    expect(() => new Encryptor(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });

  it("records which key wrapped it, so rotation knows what to re-wrap", () => {
    expect(new Encryptor(KEK, "kek-2").encrypt("x").keyId).toBe("kek-2");
  });
});

describe("token handling", () => {
  it("hashes with a pepper, so the same token differs across deployments", () => {
    expect(hashToken("t", "pepper-a")).not.toBe(hashToken("t", "pepper-b"));
    expect(hashToken("t", "pepper-a")).toBe(hashToken("t", "pepper-a"));
  });

  it("compares in constant time and tolerates unequal lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("generates URL-safe tokens with no padding", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(43);
  });
});

describe("opaque external ids", () => {
  it("gives a different id for the same record under a different scope", () => {
    const a = opaqueExternalId("uuid-1", "document", "scope-a", "s");
    const b = opaqueExternalId("uuid-1", "document", "scope-b", "s");
    expect(a).not.toBe(b);
  });

  it("never contains the internal id", () => {
    const id = "01931f4e-0000-7000-8000-000000000001";
    expect(opaqueExternalId(id, "document", "scope", "s")).not.toContain(id);
  });
});

describe("audit chain", () => {
  it("changes when an earlier link changes, which is what detects tampering", () => {
    const h1 = chainHash(null, "event-1");
    const h2 = chainHash(h1, "event-2");
    const tampered = chainHash(chainHash(null, "event-1-modified"), "event-2");
    expect(tampered).not.toBe(h2);
  });
});
