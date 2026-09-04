import { describe, it, expect, beforeEach } from "vitest";
import { consume, consumeByIpAndIdentity, normalizeIdentity, resetRateLimitsForTest } from "./rate-limit";

beforeEach(() => resetRateLimitsForTest());

describe("rate limiting", () => {
  it("allows up to the limit then refuses", () => {
    for (let i = 0; i < 10; i++) consume("auth.sign-in", "ip:1.2.3.4");
    expect(() => consume("auth.sign-in", "ip:1.2.3.4")).toThrow(/Too many attempts/);
  });

  it("counts identity separately from IP, so a botnet does not get free attempts", () => {
    // Ten different addresses, one account. An IP-only limit would never trip.
    for (let i = 0; i < 10; i++) consumeByIpAndIdentity("auth.sign-in", `10.0.0.${i}`, "owner@example.com");
    expect(() => consumeByIpAndIdentity("auth.sign-in", "10.0.0.99", "owner@example.com")).toThrow(/Too many attempts/);
  });

  it("does not let a spelling variant buy extra attempts", () => {
    for (let i = 0; i < 10; i++) consumeByIpAndIdentity("auth.sign-in", `10.0.1.${i}`, "A.User+tag@Example.COM");
    expect(() => consumeByIpAndIdentity("auth.sign-in", "10.0.1.99", "auser@example.com")).toThrow();
  });

  it("normalises dots, plus-tags and case in the local part only", () => {
    expect(normalizeIdentity("A.User+tag@Example.com")).toBe("auser@example.com");
    // The domain keeps its dots — they are structural there.
    expect(normalizeIdentity("x@sub.example.com")).toBe("x@sub.example.com");
    expect(normalizeIdentity("not-an-email")).toBe("not-an-email");
  });

  it("keeps separate budgets per action", () => {
    for (let i = 0; i < 10; i++) consume("auth.sign-in", "ip:5.5.5.5");
    expect(() => consume("auth.refresh", "ip:5.5.5.5")).not.toThrow();
  });

  it("reports how long to wait", () => {
    for (let i = 0; i < 5; i++) consume("auth.recovery", "ip:9.9.9.9");
    try {
      consume("auth.recovery", "ip:9.9.9.9");
      expect.unreachable();
    } catch (error) {
      expect((error as { meta?: Record<string, unknown> }).meta?.["retryAfterSeconds"]).toBeGreaterThan(0);
    }
  });
});
