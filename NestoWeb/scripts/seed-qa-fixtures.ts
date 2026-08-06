// QA Fixture System — extends prisma/seed.ts's core demo tenant with realistic
// data for every module built on top of it this multi-session project. Run
// AFTER the main seed (needs its tenant/users/projects/employees to exist):
//
//   npx tsx scripts/seed-qa-fixtures.ts
//
// Idempotent: every fixture file guards its own inserts (usually "does any
// row for this tenant already exist"), so re-running after the app has been
// used for a while just fills in whatever fixture group is still empty
// rather than duplicating data. It does NOT undo anything a QA session
// created by hand.
import { loadContext } from "./fixtures/context";
import { seedHrExtended } from "./fixtures/01-hr-extended";
import { seedLegalHseExtended } from "./fixtures/02-legal-hse-extended";
import { seedPlatformAdmin } from "./fixtures/03-platform-admin";
import { seedDocumentsAndTasks } from "./fixtures/04-documents-tasks";
import { seedNotificationsReportingBim } from "./fixtures/05-notifications-reporting-bim";
import { seedProcurementInventoryCrm } from "./fixtures/06-procurement-inventory-crm";
import { seedContractsExtended } from "./fixtures/07-contracts-extended";

async function main() {
  console.log("Loading QA fixture context (reading back the main seed's tenant)…\n");
  const ctx = await loadContext();
  console.log(`Tenant: ${ctx.tenant.name} (${ctx.tenantId})\n`);

  const steps: [string, (ctx: Awaited<ReturnType<typeof loadContext>>) => Promise<void>][] = [
    ["HR extended", seedHrExtended],
    ["Legal & HSE extended", seedLegalHseExtended],
    ["Platform admin", seedPlatformAdmin],
    ["Documents & Tasks", seedDocumentsAndTasks],
    ["Notifications, Reporting & BIM", seedNotificationsReportingBim],
    ["Procurement, Inventory & CRM", seedProcurementInventoryCrm],
    ["Contracts extended", seedContractsExtended],
  ];

  for (const [label, fn] of steps) {
    try {
      await fn(ctx);
    } catch (err) {
      console.error(`\n✗ ${label} failed:`, err instanceof Error ? err.message : err);
      console.error("  Continuing with the remaining fixture groups…\n");
    }
    console.log("");
  }

  console.log("QA fixture seeding complete. See QA_FIXTURES.md for the login/feature matrix.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { db } = await import("@/lib/db");
    await db.$disconnect();
  });
