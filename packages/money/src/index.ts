/**
 * Money — ADR-0011, PRD §11.5.
 *
 * The PRD forbids Float and mandates NUMERIC with an explicit currency. That
 * settles storage. It does not settle the harder half: in a JavaScript runtime
 * a Decimal will silently become a `number` the moment somebody writes `a + b`,
 * and the result displays identically until it is off by a cent in a dispute.
 *
 * So money is a value object, not a number with a label:
 *   - no `valueOf`, so `+` on a Money is a type error rather than a coercion;
 *   - arithmetic refuses two different currencies rather than guessing;
 *   - the only ways out are an explicit string, a formatted display, or a
 *     Decimal handed to the database layer.
 *
 * `allocate` uses largest-remainder distribution: the naive
 * `round(total / n)` per share does not sum back to the total, which is how
 * invoices acquire a stray cent that nobody can explain.
 */

import { Decimal } from "decimal.js";

// 34 significant digits and no exponential notation: enough for any monetary
// aggregate this platform can produce, and toString() never yields "1e+21".
Decimal.set({ precision: 34, toExpNeg: -30, toExpPos: 30, rounding: Decimal.ROUND_HALF_EVEN });

/** Currencies whose minor unit is the major unit — no cents at all. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "XAF", "XOF", "PYG", "RWF", "UGX", "VUV"]);
/** Currencies with three minor digits. */
const THREE_DECIMAL = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

export function minorUnitDigits(currency: string): number {
  const c = currency.toUpperCase();
  if (ZERO_DECIMAL.has(c)) return 0;
  if (THREE_DECIMAL.has(c)) return 3;
  return 2;
}

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`Cannot combine ${a} and ${b}. Convert explicitly with a recorded rate, or keep the totals separated.`);
    this.name = "CurrencyMismatchError";
  }
}

export class Money {
  /** 4 decimal places of storage precision per ADR-0011: enough for unit prices
   *  and tax bases. Rounding to the currency's minor unit happens at display and
   *  at the point a value becomes payable, not here. */
  private constructor(
    readonly amount: Decimal,
    readonly currency: string
  ) {
    Object.freeze(this);
  }

  static of(amount: Decimal | string | number, currency: string): Money {
    const c = currency.toUpperCase();
    if (!CURRENCY_PATTERN.test(c)) {
      throw new Error(`"${currency}" is not an ISO 4217 alphabetic code.`);
    }
    if (typeof amount === "number" && !Number.isFinite(amount)) {
      throw new Error("Amount must be finite.");
    }
    return new Money(new Decimal(amount), c);
  }

  static zero(currency: string): Money {
    return Money.of("0", currency);
  }

  /** Parse the decimal *string* an API carries (§19.1). Deliberately strict:
   *  a JSON number would already have lost precision by the time it got here. */
  static parse(value: string, currency: string): Money {
    if (!/^-?\d+(\.\d+)?$/.test(value)) {
      throw new Error(`"${value}" is not a decimal string.`);
    }
    return Money.of(value, currency);
  }

  private assertSame(other: Money): void {
    if (this.currency !== other.currency) throw new CurrencyMismatchError(this.currency, other.currency);
  }

  plus(other: Money): Money {
    this.assertSame(other);
    return new Money(this.amount.plus(other.amount), this.currency);
  }

  minus(other: Money): Money {
    this.assertSame(other);
    return new Money(this.amount.minus(other.amount), this.currency);
  }

  /** Multiply by a dimensionless quantity or rate — never by another Money. */
  times(factor: Decimal | string | number): Money {
    return new Money(this.amount.times(new Decimal(factor)), this.currency);
  }

  dividedBy(divisor: Decimal | string | number): Money {
    const d = new Decimal(divisor);
    if (d.isZero()) throw new Error("Division by zero.");
    return new Money(this.amount.dividedBy(d), this.currency);
  }

  negated(): Money {
    return new Money(this.amount.negated(), this.currency);
  }

  abs(): Money {
    return new Money(this.amount.abs(), this.currency);
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSame(other);
    return this.amount.comparedTo(other.amount) as -1 | 0 | 1;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount.equals(other.amount);
  }

  isZero(): boolean { return this.amount.isZero(); }
  isNegative(): boolean { return this.amount.isNegative() && !this.amount.isZero(); }
  isPositive(): boolean { return this.amount.isPositive() && !this.amount.isZero(); }
  greaterThan(other: Money): boolean { return this.compare(other) === 1; }
  lessThan(other: Money): boolean { return this.compare(other) === -1; }

  /** Round to the currency's minor unit, half-even. Use when a value becomes
   *  payable — an invoice line total, a payment amount. */
  toPayable(): Money {
    return new Money(this.amount.toDecimalPlaces(minorUnitDigits(this.currency), Decimal.ROUND_HALF_EVEN), this.currency);
  }

  /**
   * Split across `shares` without losing or inventing a minor unit.
   * Remainder units go to the earliest shares, so the parts always sum back to
   * exactly the original.
   */
  allocate(shares: number): Money[] {
    if (!Number.isInteger(shares) || shares <= 0) throw new Error("Share count must be a positive integer.");
    const digits = minorUnitDigits(this.currency);
    const scale = new Decimal(10).pow(digits);
    const totalUnits = this.amount.times(scale).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);
    const base = totalUnits.dividedBy(shares).toDecimalPlaces(0, Decimal.ROUND_DOWN);
    let remainder = totalUnits.minus(base.times(shares));
    const step = remainder.isNegative() ? new Decimal(-1) : new Decimal(1);

    const out: Money[] = [];
    for (let i = 0; i < shares; i++) {
      let units = base;
      if (!remainder.isZero()) {
        units = units.plus(step);
        remainder = remainder.minus(step);
      }
      out.push(new Money(units.dividedBy(scale), this.currency));
    }
    return out;
  }

  /** Allocate in proportion to weights, remainder to the largest fractional part. */
  allocateByWeights(weights: (Decimal | string | number)[]): Money[] {
    const w = weights.map((x) => new Decimal(x));
    const total = w.reduce((a, b) => a.plus(b), new Decimal(0));
    if (total.isZero()) throw new Error("Weights must not sum to zero.");

    const digits = minorUnitDigits(this.currency);
    const scale = new Decimal(10).pow(digits);
    const totalUnits = this.amount.times(scale).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN);

    const exact = w.map((x) => totalUnits.times(x).dividedBy(total));
    const floors = exact.map((x) => x.toDecimalPlaces(0, Decimal.ROUND_DOWN));
    let remainder = totalUnits.minus(floors.reduce((a, b) => a.plus(b), new Decimal(0)));

    const order = exact
      .map((x, i) => ({ i, frac: x.minus(floors[i] as Decimal) }))
      .sort((a, b) => b.frac.comparedTo(a.frac));

    const units = [...floors];
    let k = 0;
    while (remainder.greaterThan(0) && order.length > 0) {
      const target = order[k % order.length];
      if (target) units[target.i] = (units[target.i] as Decimal).plus(1);
      remainder = remainder.minus(1);
      k++;
    }
    return units.map((u) => new Money((u as Decimal).dividedBy(scale), this.currency));
  }

  /** The API representation (§19.1): a decimal string, never a JSON number. */
  toString(): string {
    return this.amount.toFixed(minorUnitDigits(this.currency));
  }

  /** Full stored precision, for handing to the database layer. */
  toStorageString(): string {
    return this.amount.toFixed(4);
  }

  toJSON(): { amount: string; currency: string } {
    return { amount: this.toString(), currency: this.currency };
  }

  format(locale: "en" | "sq" = "en"): string {
    const digits = minorUnitDigits(this.currency);
    return new Intl.NumberFormat(locale === "sq" ? "sq-AL" : "en-GB", {
      style: "currency",
      currency: this.currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(this.amount.toNumber());
  }

  /**
   * The coercion guard.
   *
   * Omitting `valueOf` is not enough. `Object.prototype.valueOf` returns the
   * object itself, so JavaScript's ToPrimitive falls through to `toString()`
   * and `money * 2` quietly evaluates to `2` — a plausible-looking number with
   * no currency, which is exactly the class of bug this type exists to prevent.
   *
   * So a numeric coercion throws. `+money`, `money * 2` and `moneyA + moneyB`
   * all fail loudly at runtime, on top of already being TypeScript errors.
   * String interpolation still works, because `${money}` is unambiguous.
   */
  [Symbol.toPrimitive](hint: string): string {
    if (hint === "string") return this.toString();
    throw new TypeError(
      "Money cannot be coerced to a number. Use .amount for the Decimal, .toString() for the API " +
        "representation, or plus/minus/times/dividedBy for arithmetic."
    );
  }
}

/** Sum a same-currency list. Empty needs an explicit currency — there is no
 *  sensible currency-less zero, and guessing one is how mixed totals start. */
export function sumMoney(values: Money[], currencyIfEmpty?: string): Money {
  if (values.length === 0) {
    if (!currencyIfEmpty) throw new Error("Cannot sum an empty list without an explicit currency.");
    return Money.zero(currencyIfEmpty);
  }
  return values.reduce((a, b) => a.plus(b));
}

/**
 * Group by currency instead of converting. §11.5: consolidated totals stay
 * separated unless an approved conversion basis is applied *and shown*, so the
 * default aggregation in this platform returns a map, not a single figure.
 */
export function totalsByCurrency(values: Money[]): Map<string, Money> {
  const out = new Map<string, Money>();
  for (const v of values) {
    const existing = out.get(v.currency);
    out.set(v.currency, existing ? existing.plus(v) : v);
  }
  return out;
}

export { Decimal };
