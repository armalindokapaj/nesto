import { describe, expect, it } from "vitest";
import { isKnownReportKind } from "@/server/analytics";

describe("report kind validation", () => {
  it("accepts the fixed set of report kinds and rejects everything else", () => {
    expect(isKnownReportKind("PROJECTS_STATUS")).toBe(true);
    expect(isKnownReportKind("HSE_SAFETY")).toBe(true);
    expect(isKnownReportKind("MADE_UP_KIND")).toBe(false);
    expect(isKnownReportKind("")).toBe(false);
  });
});
