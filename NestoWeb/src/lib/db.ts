import { PrismaClient } from "@/generated/prisma";

declare global {
  var __nestoPrisma: PrismaClient | undefined;
}

// Singleton across hot reloads in dev — avoids exhausting SQLite/Postgres
// connections when Next.js recompiles Server Components.
export const db = globalThis.__nestoPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__nestoPrisma = db;
}
