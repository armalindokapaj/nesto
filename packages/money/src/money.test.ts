import { describe, it, expect } from "vitest";
import { Money, sumMoney, totalsByCurrency, minorUnitDigits, CurrencyMismatchError } from "./index";

describe("Money", () => {
  it("is exact where binary floating point is not", () => {
    // 0.1 + 0.2 === 0.30000000000000004 as a JS number. This is the entire
    // reason the type exists.
    const sum = Money.of("0.1", "EUR").plus(Money.of("0.2", "EUR"));
    expect(sum.toString()).toBe("0.30");
    expect(sum.equals(Money.of("0.3", "EUR"))).toBe(true);
  });

  it("refuses to combine different currencies", () => {
    expect(() => Money.of("10", "EUR").plus(Money.of("10", "USD"))).toThrow(CurrencyMismatchError);
  });

  it("knows each currency's minor unit", () => {
    expect(minorUnitDigits("EUR")).toBe(2);
    expect(minorUnitDigits("JPY")).toBe(0);
    expect(minorUnitDigits("KWD")).toBe(3);
    // Half-even, so .5 goes to the even neighbour in both directions.
    expect(Money.of("1234.5", "JPY").toString()).toBe("1234");
    expect(Money.of("1235.5", "JPY").toString()).toBe("1236");
    expect(Money.of("1.2345", "KWD").toString()).toBe("1.234");
  });

  it("rounds half-even when a value becomes payable", () => {
    // Half-up would give 2.68 and 2.66; half-even sends both to the even cent.
    expect(Money.of("2.675", "EUR").toPayable().toString()).toBe("2.68");
    expect(Money.of("2.665", "EUR").toPayable().toString()).toBe("2.66");
  });

  it("allocates without losing or inventing a cent", () => {
    const parts = Money.of("100.00", "EUR").allocate(3);
    expect(parts.map((p) => p.toString())).toEqual(["33.34", "33.33", "33.33"]);
    expect(sumMoney(parts).toString()).toBe("100.00");
  });

  it("allocates negative amounts back to exactly the original", () => {
    const parts = Money.of("-0.05", "EUR").allocate(3);
    expect(sumMoney(parts).toString()).toBe("-0.05");
  });

  it("allocates by weight, remainder to the largest fraction", () => {
    const parts = Money.of("100.00", "EUR").allocateByWeights([1, 1, 1]);
    expect(sumMoney(parts).toString()).toBe("100.00");
    const uneven = Money.of("10.00", "EUR").allocateByWeights([70, 20, 10]);
    expect(uneven.map((p) => p.toString())).toEqual(["7.00", "2.00", "1.00"]);
    expect(sumMoney(uneven).toString()).toBe("10.00");
  });

  it("keeps mixed-currency totals separated rather than converting", () => {
    const totals = totalsByCurrency([
      Money.of("10", "EUR"),
      Money.of("5", "USD"),
      Money.of("2.50", "EUR"),
    ]);
    expect(totals.size).toBe(2);
    expect(totals.get("EUR")!.toString()).toBe("12.50");
    expect(totals.get("USD")!.toString()).toBe("5.00");
  });

  it("throws rather than coerce to a number", () => {
    const m = Money.of("1.00", "EUR");
    // Without the guard these would evaluate: `+m` and `m * 2` reach toString()
    // through ToPrimitive and yield 1 and 2, silently losing the currency.
    expect(() => +(m as unknown as number)).toThrow(TypeError);
    expect(() => (m as unknown as number) * 2).toThrow(TypeError);
    expect(() => (m as unknown as number) + (Money.of("2.00", "EUR") as unknown as number)).toThrow(TypeError);
    // String interpolation stays available; it is never ambiguous.
    expect(`${m}`).toBe("1.00");
    expect(Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(m), "valueOf")).toBe(false);
  });

  it("parses the decimal string an API carries and rejects anything else", () => {
    expect(Money.parse("1234.5678", "EUR").toStorageString()).toBe("1234.5678");
    expect(() => Money.parse("1e5", "EUR")).toThrow();
    expect(() => Money.parse("abc", "EUR")).toThrow();
  });

  it("survives a large aggregate without exponential notation", () => {
    const big = Money.of("999999999999999.9999", "EUR");
    expect(big.plus(Money.of("0.0001", "EUR")).toStorageString()).toBe("1000000000000000.0000");
  });

  it("rejects a non-ISO currency code", () => {
    expect(() => Money.of("1", "EURO")).toThrow();
    expect(() => Money.of("1", "e")).toThrow();
  });

  it("refuses to sum an empty list without being told the currency", () => {
    expect(() => sumMoney([])).toThrow();
    expect(sumMoney([], "EUR").toString()).toBe("0.00");
  });
});
