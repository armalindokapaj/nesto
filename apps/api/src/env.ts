/**
 * Environment validation — ADR-0017: a missing required secret fails fast at
 * boot rather than degrading silently at 3am.
 */

import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  AUTH_ACCESS_SECRET: z.string().min(32, "AUTH_ACCESS_SECRET must be at least 32 characters"),
  AUTH_REFRESH_PEPPER: z.string().min(32, "AUTH_REFRESH_PEPPER must be at least 32 characters"),
  CRYPTO_KEK: z.string().min(32),

  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_BUCKET_OBJECTS: z.string().min(1),
  STORAGE_BUCKET_QUARANTINE: z.string().min(1),

  MALWARE_SCANNER: z.enum(["clamav", "permissive-dev"]).default("permissive-dev"),

  COMPANY_WEB_URL: z.string().url().default("http://localhost:3000"),
  PLATFORM_ADMIN_URL: z.string().url().default("http://localhost:3001"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Environment is not valid:\n${detail}`);
  }
  // The one combination that must never reach production, checked here rather
  // than only inside the scanner, so it fails at boot and not at first upload.
  if (parsed.data.NODE_ENV === "production" && parsed.data.MALWARE_SCANNER === "permissive-dev") {
    throw new Error("MALWARE_SCANNER=permissive-dev is refused in production (ADR-0007, deviation D-3).");
  }
  cached = parsed.data;
  return cached;
}
