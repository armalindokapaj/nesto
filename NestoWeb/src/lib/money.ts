// Phase 14 — money is stored as Float in 114 schema fields and Decimal in
// none. IEEE-754 binary floating point cannot represent most decimal
// fractions exactly, so 0.1 + 0.2 is 0.30000000000000004, and the error
// compounds across every sum, comparison and rounding step. On a payroll run
// or an invoice ledger that eventually becomes a real dispute with a real
// person, and it is invisible in a quick check because 19.99 and 1999/100 both
// display as "19.99".
//
// Integer minor units rather than Prisma's Decimal: Decimal is genuinely exact,
// but every read comes back as a Decimal.js instance, so ordinary arithmetic
// silently coerces back to Number unless every call site is disciplined —
// exactly the failure this is meant to prevent. An Int cannot be arithmetic'd
// wrongly by accident, and the boundary conversion is visible in the code.
//
// Not every Float is money: CurrencyRate.rate is a ratio, not a coin count,
// and stays as-is. Do not over-apply this.

/** Currencies with no minor unit at all, where 1 major unit is the smallest coin. */
const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "XAF", "XOF"]);

export function minorUnitFactor(currency = "EUR"): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
}

/**
 * Decimal amount (what a form collects) to integer minor units (what is stored).
 * Rounds half away from zero, which is what a person doing this by hand expects;
 * Math.round alone rounds half UP, so -1.005 would go the wrong way.
 */
export function toMinorUnits(amount: number, currency = "EUR"): number {
  if (!Number.isFinite(amount)) throw new Error("Amount must be a finite number.");
  const factor = minorUnitFactor(currency);
  // The epsilon nudge corrects the representation error itself: 1.005 * 100 is
  // 100.49999999999999 in binary floating point, which would truncate to 100
  // instead of 101 — precisely the bug this module exists to remove.
  const scaled = amount * factor;
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled) + Number.EPSILON * Math.abs(scaled));
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Integer minor units back to a decimal amount, for display or for an API that wants one. */
export function fromMinorUnits(minor: number, currency = "EUR"): number {
  return minor / minorUnitFactor(currency);
}

/** Sum minor units. Exact by construction — the whole point of storing integers. */
export function sumMinor(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

/**
 * Split an amount across n shares without losing or inventing a cent.
 * Remainder cents go to the earliest shares, so the parts always add back to
 * exactly the total — the naive `Math.round(total / n)` per share does not.
 */
export function allocateMinor(totalMinor: number, shares: number): number[] {
  if (shares <= 0) throw new Error("Share count must be positive.");
  const base = Math.trunc(totalMinor / shares);
  let remainder = totalMinor - base * shares;
  const step = Math.sign(remainder) || 1;
  return Array.from({ length: shares }, () => {
    if (remainder !== 0) {
      remainder -= step;
      return base + step;
    }
    return base;
  });
}

export function formatMinor(minor: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(fromMinorUnits(minor, currency));
}

/**
 * Whole units, no cents — the presentation `formatCurrency` gives, for the
 * dashboard tiles and summary rows that used it before the money migration.
 *
 * Keeping both matters: an invoice or a payslip line must show its cents,
 * because that is the figure someone is paid or owed. A budget tile reading
 * "500.000,00 €" is two characters of noise on a number nobody tracks to the
 * cent, and switching those to formatMinor silently changed 85 of them.
 */
export function formatMinorWhole(minor: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(fromMinorUnits(minor, currency));
}
