import { describe, it, expect, vi, afterEach } from "vitest";
import { Prisma } from "@/generated/prisma";
import { toActionError } from "@/lib/errors";
import { scrub, reportError, isInternalError } from "@/lib/observability";

// Phase 5 — 88+ action catch blocks returned `err.message` straight to the
// client. That is right for this codebase's deliberate business-rule errors,
// and wrong for a Prisma error that escapes into the same block carrying
// constraint names, column names or connection detail.
describe("error handling", () => {
  afterEach(() => vi.restoreAllMocks());

  const prismaError = () =>
    new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`email`)", {
      code: "P2002",
      clientVersion: "6.19.3",
      meta: { target: ["email"] },
    });

  describe("toActionError", () => {
    it("passes a deliberate business-rule message through unchanged", () => {
      // These were written for the user; rewriting them would be busywork.
      expect(toActionError(new Error("Invoice not found."), "fallback")).toBe("Invoice not found.");
    });

    it("replaces a Prisma error with the caller's fallback", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const message = toActionError(prismaError(), "Could not save the record.");
      expect(message).toBe("Could not save the record.");
      expect(message).not.toMatch(/constraint|email|P2002/i);
    });

    it("reports the internal error rather than swallowing it", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      toActionError(prismaError(), "Could not save the record.");
      expect(spy).toHaveBeenCalledOnce();
      const logged = JSON.parse(spy.mock.calls[0][0] as string);
      // The detail withheld from the user is kept for whoever debugs it.
      expect(logged).toMatchObject({ kind: "PrismaKnownRequestError", code: "P2002" });
    });

    it("handles a non-Error throw", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      expect(toActionError("just a string", "fallback")).toBe("fallback");
      expect(toActionError(undefined, "fallback")).toBe("fallback");
    });
  });

  describe("isInternalError", () => {
    it("distinguishes app errors from database and non-Error throws", () => {
      expect(isInternalError(new Error("Only a verified defect can be closed."))).toBe(false);
      expect(isInternalError(prismaError())).toBe(true);
      expect(isInternalError({ nope: true })).toBe(true);
    });
  });

  describe("scrubbing", () => {
    it("redacts sensitive keys at any depth", () => {
      const scrubbed = scrub({
        userId: "u1",
        passwordHash: "$2b$10$secret",
        payroll: { grossPay: 5000, netPay: 4100, employee: { name: "Ana", bankAccount: "AL47..." } },
      }) as Record<string, unknown>;
      expect(scrubbed.userId).toBe("u1");
      expect(scrubbed.passwordHash).toBe("[redacted]");
      const payroll = scrubbed.payroll as Record<string, unknown>;
      expect(payroll.grossPay).toBe("[redacted]");
      expect((payroll.employee as Record<string, unknown>).bankAccount).toBe("[redacted]");
      // Non-sensitive neighbours survive, or the log would be useless.
      expect((payroll.employee as Record<string, unknown>).name).toBe("Ana");
    });

    it("survives arrays, nulls and cyclic depth without throwing", () => {
      expect(scrub([{ token: "abc" }, null, 3])).toEqual([{ token: "[redacted]" }, null, 3]);
      const cyclic: Record<string, unknown> = { a: 1 };
      cyclic.self = cyclic;
      expect(() => scrub(cyclic)).not.toThrow();
    });

    it("scrubs the context attached to a report", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      reportError(new Error("boom"), { employeeId: "e1", grossSalary: 91000 });
      const logged = JSON.parse(spy.mock.calls[0][0] as string);
      expect(logged.context).toEqual({ employeeId: "e1", grossSalary: "[redacted]" });
    });
  });
});
