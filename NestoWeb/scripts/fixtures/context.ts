// Shared context for the QA fixture system (scripts/seed-qa-fixtures.ts and
// scripts/fixtures/*.ts). Deliberately reads back what prisma/seed.ts
// already created rather than taking params — each fixture file is
// independently re-runnable via the orchestrator without needing the main
// seed's in-memory objects.
import { db } from "@/lib/db";

export async function loadContext() {
  const tenant = await db.tenant.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const tenantId = tenant.id;
  const company = await db.company.findFirstOrThrow({ where: { tenantId, isParent: true } });

  const owner = await db.userIdentity.findFirstOrThrow({
    where: { memberships: { some: { tenantId, role: "OWNER" } } },
  });

  const byUsername = async (username: string) => db.userIdentity.findFirstOrThrow({ where: { username } });
  const [arben, elira, gentian, sara, besnik, fatjon, ana] = await Promise.all([
    byUsername("arben.kola"),
    byUsername("elira.doda"),
    byUsername("gentian.hoxha"),
    byUsername("sara.mema"),
    byUsername("besnik.lala"),
    byUsername("fatjon.dervishi"),
    byUsername("ana.krasniqi"),
  ]);

  // Per-role test accounts (one per ROLES entry, e.g. "Client", "Contractor",
  // "Legal", "Hse") — already seeded by prisma/seed.ts's per-role loop.
  // Reused here rather than minting new logins, so the QA login matrix in
  // QA_FIXTURES.md stays the single source of truth for "who can I log in
  // as to see this."
  const roleAccount = async (name: string) => db.userIdentity.findFirstOrThrow({ where: { username: name } });

  const projects = await db.project.findMany({ where: { tenantId }, orderBy: { code: "asc" } });
  const [riverside, metroMall, greenValley, skyline] = projects;

  const employees = await db.employee.findMany({ where: { tenantId }, orderBy: { hireDate: "asc" } });

  return {
    db,
    tenantId,
    tenant,
    companyId: company.id,
    company,
    owner,
    users: { arben, elira, gentian, sara, besnik, fatjon, ana },
    roleAccount,
    projects: { all: projects, riverside, metroMall, greenValley, skyline },
    employees,
  };
}

export type FixtureContext = Awaited<ReturnType<typeof loadContext>>;

/** Guard helper — every fixture file uses this instead of upsert, since most of these models have no natural unique key to upsert on. */
export async function once<T>(check: () => Promise<unknown>, create: () => Promise<T>, label: string): Promise<T | null> {
  const existing = await check();
  if (existing) return null;
  const created = await create();
  console.log(`  + ${label}`);
  return created;
}

/**
 * tsx transforms each server module lazily on first use; when that first
 * use happens to fall inside a `db.$transaction(...)` callback (several
 * server functions wrap their writes that way), the one-off transform cost
 * eats into Prisma's default 5s interactive-transaction budget and the
 * transaction is closed out from under it. Retrying immediately succeeds
 * because the module is already warm — this is a script-environment
 * artifact, not a real app bug (the same code runs fine inside Next.js,
 * which transforms everything up front at build time).
 */
export async function withColdStartRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Error && e.message.includes("Transaction already closed")) {
      return fn();
    }
    throw e;
  }
}
