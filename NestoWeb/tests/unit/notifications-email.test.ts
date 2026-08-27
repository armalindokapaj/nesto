import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, emailFromAddress } from "@/lib/email";

// Phase 2 Track A — before this there was no email/SMS/push channel anywhere,
// which mattered most for the events the catalogue marks EMERGENCY.
describe("email adapter", () => {
  const env = { ...process.env };
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  const msg = { to: ["a@example.com"], subject: "Stop-work order issued", text: "Site B halted." };

  it("suppresses rather than pretends when no provider is configured", async () => {
    delete process.env.EMAIL_DRIVER;
    const result = await sendEmail(msg);
    // 0 delivered, and a reason — never a fake success.
    expect(result).toMatchObject({ delivered: 0, driver: "log" });
    expect(result.skipped).toMatch(/not set to a real provider/i);
  });

  it("logs the routing without the body", async () => {
    delete process.env.EMAIL_DRIVER;
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    await sendEmail(msg);
    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ kind: "EmailSuppressed", to: 1, subject: "Stop-work order issued" });
    // Notification bodies routinely carry payroll and HSE detail.
    expect(JSON.stringify(logged)).not.toContain("Site B halted");
  });

  it("drops invalid addresses and de-duplicates recipients", async () => {
    delete process.env.EMAIL_DRIVER;
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    await sendEmail({ ...msg, to: ["a@example.com", "a@example.com", "not-an-address", ""] });
    expect(JSON.parse(spy.mock.calls[0][0] as string).to).toBe(1);
  });

  it("reports rather than sends when the driver is set but the key is missing", async () => {
    process.env.EMAIL_DRIVER = "resend";
    delete process.env.RESEND_API_KEY;
    const result = await sendEmail(msg);
    expect(result).toMatchObject({ delivered: 0, driver: "resend" });
    expect(result.skipped).toMatch(/missing RESEND_API_KEY/i);
  });

  // A channel that can fail the write which triggered it is worse than one
  // that is merely unavailable.
  it("never throws when the provider call fails", async () => {
    process.env.EMAIL_DRIVER = "resend";
    process.env.RESEND_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(sendEmail(msg)).resolves.toMatchObject({ delivered: 0, skipped: "send failed" });
    vi.unstubAllGlobals();
  });

  it("never throws on a provider error response", async () => {
    process.env.EMAIL_DRIVER = "resend";
    process.env.RESEND_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422 }));
    await expect(sendEmail(msg)).resolves.toMatchObject({ delivered: 0, skipped: "provider error 422" });
    vi.unstubAllGlobals();
  });

  it("reports delivery when the provider accepts", async () => {
    process.env.EMAIL_DRIVER = "resend";
    process.env.RESEND_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    await expect(sendEmail({ ...msg, to: ["a@x.com", "b@x.com"] })).resolves.toEqual({ delivered: 2, driver: "resend" });
    vi.unstubAllGlobals();
  });

  it("has a from address without configuration", () => {
    expect(emailFromAddress()).toContain("@");
  });
});
