import { describe, it, expect } from "vitest";
import { nextAttemptDelayMs, isExhausted, MAX_ATTEMPTS } from "./backoff";

describe("retry backoff", () => {
  it("doubles with each attempt", () => {
    const noJitter = () => 0.5;
    expect(nextAttemptDelayMs(1, noJitter)).toBe(2000);
    expect(nextAttemptDelayMs(2, noJitter)).toBe(4000);
    expect(nextAttemptDelayMs(3, noJitter)).toBe(8000);
  });

  it("caps, so a retry never lands days later", () => {
    const noJitter = () => 0.5;
    expect(nextAttemptDelayMs(20, noJitter)).toBe(300_000);
  });

  it("spreads retries across a window rather than synchronising them", () => {
    // The property that matters: two consumers that failed at the same instant
    // must not retry at the same instant, or the recovering dependency is
    // knocked over again.
    const delays = new Set(Array.from({ length: 200 }, () => nextAttemptDelayMs(4)));
    expect(delays.size).toBeGreaterThan(100);
  });

  it("keeps jitter within a quarter either side", () => {
    const base = 2 ** 4 * 1000;
    for (let i = 0; i < 500; i++) {
      const d = nextAttemptDelayMs(4);
      expect(d).toBeGreaterThanOrEqual(base * 0.75);
      expect(d).toBeLessThanOrEqual(base * 1.25);
    }
  });

  it("gives up after a bounded number of attempts", () => {
    expect(isExhausted(MAX_ATTEMPTS - 1)).toBe(false);
    expect(isExhausted(MAX_ATTEMPTS)).toBe(true);
  });
});
