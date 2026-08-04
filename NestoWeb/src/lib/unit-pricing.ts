// PRD_Unit_Page §6 — component-based pricing engine. Pure functions so the
// frontend can preview the same math the backend uses as final authority
// (UNIT-007): the backend always re-runs these on save, never trusts a
// client-submitted total.

export type AreaComponentInput = {
  id?: string;
  componentType: string;
  label: string;
  areaM2: number;
  pricePerM2: number;
  isMain: boolean;
  includedInTotal: boolean;
  order: number;
};

export function componentSubtotal(component: Pick<AreaComponentInput, "areaM2" | "pricePerM2">): number {
  return component.areaM2 * component.pricePerM2;
}

export function finalPrice(components: AreaComponentInput[], fixedAdjustment: number): number {
  const includedSum = components.filter((c) => c.includedInTotal).reduce((sum, c) => sum + componentSubtotal(c), 0);
  return includedSum + fixedAdjustment;
}

// Reporting-only figure — never a separate source of truth (PRD §6).
export function blendedPricePerM2(components: AreaComponentInput[], fixedAdjustment: number): number | null {
  const includedArea = components.filter((c) => c.includedInTotal).reduce((sum, c) => sum + c.areaM2, 0);
  if (includedArea <= 0) return null;
  return finalPrice(components, fixedAdjustment) / includedArea;
}

export function findMainComponent(components: AreaComponentInput[]): AreaComponentInput | undefined {
  return components.find((c) => c.isMain);
}

// Exactly one isMain, and it must be includedInTotal (otherwise a "final
// total" edit would be a silent no-op — nothing to back-calculate into).
export function validateComponentSet(components: AreaComponentInput[]): string | null {
  if (components.length === 0) return "Add at least one area component.";
  const mainCount = components.filter((c) => c.isMain).length;
  if (mainCount !== 1) return "Exactly one area component must be marked as main.";
  const main = findMainComponent(components)!;
  if (!main.includedInTotal) return "The main area component must be included in the total.";
  if (components.some((c) => c.areaM2 < 0 || c.pricePerM2 < 0)) return "Area and price per m² cannot be negative.";
  return null;
}

export type BackCalculateResult = { mainPricePerM2: number } | { error: string };

// PRD §6 — editing the final total back-calculates the main component's
// price/m2, leaving every other component's price untouched.
export function backCalculateMainPriceFromTotal(
  components: AreaComponentInput[],
  fixedAdjustment: number,
  enteredTotal: number
): BackCalculateResult {
  const validationError = validateComponentSet(components);
  if (validationError) return { error: validationError };

  const main = findMainComponent(components)!;
  const otherIncludedSum = components
    .filter((c) => c.includedInTotal && c !== main)
    .reduce((sum, c) => sum + componentSubtotal(c), 0);

  const minimumValidTotal = otherIncludedSum + fixedAdjustment;
  if (enteredTotal < minimumValidTotal) {
    return { error: `Total price must be at least ${minimumValidTotal.toLocaleString()} (the sum of the other included components).` };
  }
  if (main.areaM2 === 0) {
    return { error: "The main area component has zero area — enter a valid area before editing the total price." };
  }

  const newMainSubtotal = enteredTotal - otherIncludedSum - fixedAdjustment;
  return { mainPricePerM2: newMainSubtotal / main.areaM2 };
}
