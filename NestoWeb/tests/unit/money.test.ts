import { describe, it, expect } from "vitest";
import { toMinorUnits, fromMinorUnits, sumMinor, allocateMinor, formatMinor, minorUnitFactor } from "@/lib/money";

// Phase 14 — money was Float in 114 schema fields and Decimal in none. The bug
// this closes is invisible in a quick check (19.99 and 1999/100 both display as
// "19.99") and only surfaces once enough operations compound, so these tests
// are written to be falsifiable rather than defensive.
describe("money in minor units", () => {
  describe("the problem, demonstrated", () => {
    it("float addition of ordinary money amounts is already wrong at two values", () => {
      // The canonical case, in money terms: €0.10 + €0.20.
      expect(0.1 + 0.2).not.toBe(0.3);
      expect(0.1 + 0.2).toBeCloseTo(0.30000000000000004, 20);
      // The same two amounts in cents are exact.
      expect(sumMinor([10, 20])).toBe(30);
    });

    it("a payroll run's float total drifts off the exact figure; the integer total does not", () => {
      // 1000 payslip lines of €1,234.56 — an ordinary run, not a contrived one.
      const amount = 1234.56;
      const lines = 1000;

      let floatTotal = 0;
      for (let i = 0; i < lines; i++) floatTotal += amount;

      const minorTotal = sumMinor(Array.from({ length: lines }, () => toMinorUnits(amount)));

      // The exact answer is €1,234,560.00 — i.e. 123_456_000 cents.
      expect(minorTotal).toBe(123_456_000);
      // The float sum is NOT that number. This assertion is the falsifiable
      // part: if floats were adequate here it would fail.
      expect(floatTotal).not.toBe(1_234_560);
      expect(Math.abs(floatTotal - 1_234_560)).toBeGreaterThan(0);
      // And the integer total converts back to exactly the right decimal.
      expect(fromMinorUnits(minorTotal)).toBe(1_234_560);
    });

    it("float subtraction leaves a residue that is not zero, so a paid-in-full check can fail", () => {
      // A contract of €0.30 paid in two instalments of €0.10 and €0.20.
      expect(0.3 - (0.1 + 0.2)).not.toBe(0);
      // The same comparison in minor units is exact, which is why
      // contract-lifecycle compares in minor units now.
      expect(30 - sumMinor([10, 20])).toBe(0);
    });
  });

  describe("conversion", () => {
    it("round-trips ordinary amounts", () => {
      for (const v of [0, 1, 19.99, 1234.56, 0.01, 999_999.99]) {
        expect(fromMinorUnits(toMinorUnits(v))).toBe(v);
      }
    });

    // 1.005 * 100 is 100.49999999999999 in binary floating point, so a naive
    // truncation gives 100 — one cent lost, on exactly the boundary case that
    // shows up in tax and percentage calculations.
    it("rounds the representation-error boundary the way a person would", () => {
      expect(toMinorUnits(1.005)).toBe(101);
      expect(toMinorUnits(2.675)).toBe(268);
      expect(toMinorUnits(8.165)).toBe(817);
    });

    it("rounds half away from zero, symmetrically for negatives", () => {
      // Bills are stored as negative amounts in this schema, so the negative
      // side has to behave — Math.round alone rounds -1.005 the wrong way.
      expect(toMinorUnits(-1.005)).toBe(-101);
      expect(toMinorUnits(-19.99)).toBe(-1999);
      expect(Object.is(toMinorUnits(-0.001), 0)).toBe(true);
    });

    it("refuses a non-finite amount rather than storing NaN", () => {
      expect(() => toMinorUnits(NaN)).toThrow();
      expect(() => toMinorUnits(Infinity)).toThrow();
    });

    it("knows currencies with no minor unit", () => {
      expect(minorUnitFactor("JPY")).toBe(1);
      expect(minorUnitFactor("eur")).toBe(100);
      expect(toMinorUnits(1200, "JPY")).toBe(1200);
      expect(fromMinorUnits(1200, "JPY")).toBe(1200);
    });
  });

  describe("allocation", () => {
    it("splits without losing or inventing a cent", () => {
      // €10.00 across 3 ways: the naive round-each-share answer loses a cent.
      const parts = allocateMinor(1000, 3);
      expect(parts).toEqual([334, 333, 333]);
      expect(sumMinor(parts)).toBe(1000);
    });

    it("holds for negatives and for exact divisions", () => {
      expect(sumMinor(allocateMinor(-1000, 3))).toBe(-1000);
      expect(allocateMinor(900, 3)).toEqual([300, 300, 300]);
      expect(allocateMinor(5, 10).reduce((a, b) => a + b, 0)).toBe(5);
    });

    it("rejects a nonsense share count", () => {
      expect(() => allocateMinor(100, 0)).toThrow();
    });
  });

  describe("formatting", () => {
    it("renders minor units as the amount a person expects", () => {
      // The failure mode worth guarding: showing 1999 where €19.99 belongs.
      expect(formatMinor(1999, "EUR")).toContain("19,99");
      expect(formatMinor(123_456_000, "EUR")).toContain("1.234.560");
    });
  });
});
