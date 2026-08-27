import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendVerificationEmail } from "@/server/public-signup";

// Phase 13 — registerPublicAccount() returned the verification token straight
// back to whoever submitted the form, so "email verification" never required
// access to the email account. Anyone could register a colleague's or a
// competitor's address and verify it themselves, and a Platform Admin reviewing
// the application reads that checkmark as an identity signal.
describe("email verification (Phase 13)", () => {
  const env = { ...process.env };
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("never reveals the token once an email has actually been sent", async () => {
    process.env.EMAIL_DRIVER = "resend";
    process.env.RESEND_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const result = await sendVerificationEmail("applicant@example.com", "tok-1");
    expect(result).toEqual({ delivered: 1, canRevealToken: false });
  });

  it("never reveals the token in production, even when the send fails", async () => {
    // A broken signup is recoverable via resend; a meaningless verification
    // checkmark is not.
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.EMAIL_DRIVER;
    const result = await sendVerificationEmail("applicant@example.com", "tok-2");
    expect(result.canRevealToken).toBe(false);
    expect(result.delivered).toBe(0);
  });

  it("surfaces the failure rather than failing silently in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.EMAIL_DRIVER;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await sendVerificationEmail("applicant@example.com", "tok-3");
    expect(JSON.parse(spy.mock.calls[0][0] as string).message).toMatch(/could not be sent/i);
  });

  it("still allows development and CI to verify without an email provider", async () => {
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.EMAIL_DRIVER;
    const result = await sendVerificationEmail("applicant@example.com", "tok-4");
    expect(result.canRevealToken).toBe(true);
  });

  it("puts the verification link, not the raw token, in the message", async () => {
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.EMAIL_DRIVER;
    process.env.APP_URL = "https://nesto.example";
    process.env.EMAIL_DRIVER = "resend";
    process.env.RESEND_API_KEY = "k";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    await sendVerificationEmail("applicant@example.com", "tok-5");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toEqual(["applicant@example.com"]);
    expect(body.text).toContain("https://nesto.example/apply/verify?token=tok-5");
  });
});
