import "server-only";
import { reportError } from "@/lib/observability";

// Phase 2 Track A — every notification in this system was an in-app row only:
// no email, SMS or push anywhere, and no provider dependency in package.json.
// That matters most for the events the catalogue itself marks EMERGENCY —
// HSE.STOP_WORK_ISSUED reaching someone only as a bell icon they have to be
// logged in to notice is not doing the job an emergency alert exists to do.
//
// Driver-based, same shape as lib/storage.ts. Choosing an email vendor, holding
// its API key and paying its bill is an account decision, so the default driver
// records what would be sent instead of pretending it went out. Setting
// EMAIL_DRIVER=resend plus RESEND_API_KEY switches it over; nothing else moves.
export type EmailMessage = {
  to: string[];
  subject: string;
  text: string;
  /** For grouping/idempotency in a provider that supports it. */
  tag?: string;
};

export type EmailResult = { delivered: number; driver: string; skipped?: string };

function driver(): "log" | "resend" {
  return process.env.EMAIL_DRIVER === "resend" ? "resend" : "log";
}

export function emailFromAddress() {
  return process.env.EMAIL_FROM ?? "Nesto <no-reply@nesto.local>";
}

/**
 * Never throws. A notification channel that can take down the write that
 * triggered it is worse than one that is merely unavailable — publishEvent()
 * has already committed the in-app rows by the time this runs.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const recipients = [...new Set(message.to.filter((address) => address.includes("@")))];
  if (recipients.length === 0) return { delivered: 0, driver: driver(), skipped: "no valid recipients" };

  if (driver() === "log") {
    // Structured, and deliberately without the body: subject and recipient
    // count are enough to confirm routing, and notification bodies routinely
    // carry the payroll and HSE detail lib/observability.ts scrubs elsewhere.
    console.info(
      JSON.stringify({ level: "info", kind: "EmailSuppressed", driver: "log", to: recipients.length, subject: message.subject, tag: message.tag })
    );
    return { delivered: 0, driver: "log", skipped: "EMAIL_DRIVER is not set to a real provider" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    reportError(new Error("EMAIL_DRIVER=resend but RESEND_API_KEY is unset"), { subject: message.subject });
    return { delivered: 0, driver: "resend", skipped: "missing RESEND_API_KEY" };
  }

  try {
    // Called over HTTP rather than through the SDK so this adds no dependency
    // until the vendor is actually chosen; the payload is Resend's documented
    // shape and swapping in `resend.emails.send` later is a local change.
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: emailFromAddress(), to: recipients, subject: message.subject, text: message.text }),
    });
    if (!response.ok) {
      reportError(new Error(`Email provider returned ${response.status}`), { subject: message.subject });
      return { delivered: 0, driver: "resend", skipped: `provider error ${response.status}` };
    }
    return { delivered: recipients.length, driver: "resend" };
  } catch (err) {
    reportError(err, { subject: message.subject });
    return { delivered: 0, driver: "resend", skipped: "send failed" };
  }
}
