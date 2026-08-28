import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A static check, not a behavioural one.
 *
 * Half the money in this schema is `Int` minor units (`*Minor`) and half is
 * still a decimal `Float`. Both are `number` to TypeScript, so mixing them
 * compiles, passes lint, and renders a plausible-looking figure that is wrong
 * by exactly 100x. That bug shipped: budget-usage read 4,000% instead of 40%,
 * every spending bill was flagged over budget, contracts never reconciled to
 * paid-in-full, and approving a contract wrote a payment for 100x its value.
 *
 * The convention that makes it visible is: any value holding minor units is
 * named `...Minor`. Given that, the mistake becomes greppable, and this test
 * is the grep. It is deliberately textual — the whole point is to catch what
 * the type checker cannot.
 */

const MINOR_FIELDS = [
  "amountMinor", "discountMinor", "freightMinor", "grossSalaryMinor", "lineTotalMinor",
  "netSalaryMinor", "subtotalMinor", "taxMinor", "totalMinor", "unitPriceMinor", "valueMinor",
];

/** Money columns still stored as decimal Float, per prisma/schema.prisma. */
const FLOAT_MONEY = [
  "baselineAmount", "balance", "budget", "contractValue", "estimatedAmount", "estimatedUnitCost",
  "targetValue", "deltaAmount", "claimedValue", "acceptedValue", "certifiedValue",
  "estimatedValue", "depositAmount", "askingPrice", "finalPrice", "purchaseValue", "salvageValue",
  "bookValue", "disposalValue", "estimatedCost", "laborCost", "materialCost", "insuredValue",
  "grossSalary", "netSalary", "previousAmount", "newAmount", "currentValue", "unitCost",
  "costPerSeat", "costImpact", "pricePerM2", "minContractValue", "maxContractValue",
];

// Any identifier ending in `Minor`, not only the schema columns — the whole
// convention is that the suffix travels with the value through locals,
// object keys and payload fields.
const minorRe = /\b\w+Minor\b/;
const floatRe = new RegExp(`\\.(${FLOAT_MONEY.join("|")})\\b`);
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "generated" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry) && !entry.includes(".test.")) acc.push(full);
  }
  return acc;
}

type Finding = { file: string; line: number; why: string; text: string };

/**
 * Reduce a line to just the code where a unit mistake could actually happen:
 * drop string literals (so a `t("projectFinance.budget")` key is not read as a
 * money field), drop `toMinorUnits(...)` calls (that is the sanctioned place a
 * Float becomes minor), and drop null-comparisons (a `x.budget == null` guard
 * does no arithmetic).
 */
function residual(line: string): string {
  return line
    .replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""')
    .replace(/toMinorUnits\([^)]*\)/g, "0")
    .replace(/[!=]==?\s*null/g, "");
}

const ARITHMETIC = /[-+*/]|<=?|>=?/;

function scan(): Finding[] {
  const findings: Finding[] = [];
  for (const file of sourceFiles("src")) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((text, i) => {
      const at = { file, line: i + 1, text: text.trim() };
      const code = residual(text);
      if (minorRe.test(code) && floatRe.test(code) && ARITHMETIC.test(code)) {
        findings.push({ ...at, why: "mixes minor-unit and decimal-Float money in one expression" });
      }
      if (/formatCurrency\([^)]*Minor/.test(text) || /formatSalaryAmount\([^)]*Minor/.test(text)) {
        findings.push({ ...at, why: "major-unit formatter applied to a minor-unit value (renders 100x)" });
      }
      if (/toMinorUnits\([^),]*Minor\b/.test(text)) {
        findings.push({ ...at, why: "converts an already-minor value again (stores 100x)" });
      }
      if (/Intl\.NumberFormat\([^)]*\)\.format\([^)]*Minor\b/.test(text)) {
        findings.push({ ...at, why: "raw Intl formatting of a minor-unit value" });
      }
    });
  }
  return findings;
}

describe("money units", () => {
  it("never mixes minor units with decimal money, or renders minor units as major", () => {
    const findings = scan();
    const report = findings.map((f) => `${f.file}:${f.line} — ${f.why}\n    ${f.text}`).join("\n");
    expect(report).toBe("");
  });

  it("does not report the shapes that are actually correct", () => {
    // Guards the guard. Each of these appears verbatim in the codebase and
    // must stay silent, or the check gets muted by whoever hits it next.
    const fine = [
      "grossSalaryMinor: toMinorUnits(currentSalary.grossSalary, currentSalary.currency),",
      "return usedMinor > toMinorUnits(budget.baselineAmount, budget.currency);",
      'value={formatMinor(row.actualExpensesMinor)} / {t("projects.budget")}',
      "budgetMinor: project?.budget == null ? null : budgetMinor,",
    ];
    for (const line of fine) {
      const code = residual(line);
      expect(minorRe.test(code) && floatRe.test(code) && ARITHMETIC.test(code), line).toBe(false);
    }
  });

  it("still flags the shipped bugs this was written after", () => {
    const bad = [
      // finance.ts computeOverBudget — minor-unit spend vs a Float baseline.
      "return usedMinor > budget.baselineAmount;",
      // finance-dashboard.ts — 100x on every KPI tile.
      "formatCurrency(data.kpis.revenueMinor)",
      // contract-lifecycle.ts — threshold 100x too high, so no contract ever completed.
      "if ((paid._sum.amountMinor ?? 0) < toMinorUnits(contract.valueMinor, contract.currency)) return;",
    ];
    for (const line of bad) {
      const code = residual(line);
      const flagged =
        (minorRe.test(code) && floatRe.test(code) && ARITHMETIC.test(code)) ||
        /formatCurrency\([^)]*Minor/.test(line) ||
        /toMinorUnits\([^),]*Minor\b/.test(line);
      expect(flagged, line).toBe(true);
    }
  });

  it("is honest about the one bug it could not have caught", () => {
    // The contract-approval reaction did `amountMinor: toMinorUnits(value)`
    // where `value` was a domain-event payload field already holding minor
    // units. Nothing textual can see that — the unit is invisible in the name.
    const asShipped = "amountMinor: toMinorUnits(value, currency),";
    expect(/toMinorUnits\([^),]*Minor\b/.test(asShipped)).toBe(false);

    // Renaming the payload field for its unit is what makes it visible, which
    // is the argument for the convention rather than for a cleverer regex.
    const renamed = "amountMinor: toMinorUnits(valueMinor, currency),";
    expect(/toMinorUnits\([^),]*Minor\b/.test(renamed)).toBe(true);
  });
});
