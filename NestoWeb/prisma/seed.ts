import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";
import { ROLES } from "../src/lib/constants";

const db = new PrismaClient();

const DEMO_PASSWORD = "1";

// Mirrors src/server/number-series.ts's format/atomicity contract, duplicated
// here (rather than imported) so this script doesn't depend on the "@/"
// path-alias resolution the app's tsconfig sets up for Next.js — tsx runs
// this file standalone.
const SEED_SERIES_CONFIG: Record<string, { prefix: string; seqLength: number; includeYear: boolean }> = {
  CONTRACT: { prefix: "CON", seqLength: 5, includeYear: true },
  CONTRACTOR: { prefix: "CTR", seqLength: 6, includeYear: false },
  SUPPLIER: { prefix: "SUP", seqLength: 6, includeYear: false },
  PURCHASE_REQUEST: { prefix: "PR", seqLength: 6, includeYear: true },
  PROCUREMENT_PACKAGE: { prefix: "PKG", seqLength: 5, includeYear: true },
  PROCUREMENT_RFQ: { prefix: "RFQ", seqLength: 5, includeYear: true },
  SUPPLIER_QUOTATION: { prefix: "QUO", seqLength: 5, includeYear: true },
  PURCHASE_ORDER: { prefix: "PO", seqLength: 5, includeYear: true },
  PROCUREMENT_DELIVERY: { prefix: "DEL", seqLength: 5, includeYear: true },
};

async function allocateSeedNumber(tenantId: string, entityType: keyof typeof SEED_SERIES_CONFIG): Promise<string> {
  const config = SEED_SERIES_CONFIG[entityType];
  const existing = await db.numberSeries.findUnique({ where: { tenantId_entityType: { tenantId, entityType } } });
  const sequence = existing ? existing.nextValue : 1;

  if (existing) {
    await db.numberSeries.update({ where: { id: existing.id }, data: { nextValue: { increment: 1 } } });
  } else {
    await db.numberSeries.create({ data: { tenantId, entityType, prefix: config.prefix, nextValue: 2 } });
  }

  const seq = String(sequence).padStart(config.seqLength, "0");
  return config.includeYear ? `${config.prefix}-${new Date().getFullYear()}-${seq}` : `${config.prefix}-${seq}`;
}

async function main() {
  console.log("Seeding Nesto demo data…");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const tenant = await db.tenant.create({
    data: { name: "BuildCore Group", slug: "buildcore" },
  });

  const company = await db.company.create({
    data: {
      tenantId: tenant.id,
      name: "BuildCore Group",
      legalName: "BuildCore Group Sh.p.k.",
      countryCode: "AL",
      planName: "Enterprise",
      seatLimit: 50,
      isParent: true,
    },
  });

  await db.branch.create({
    data: { companyId: company.id, name: "Tirana HQ", address: "Rruga e Kavajës, Tirana", isRegisteredBranch: true },
  });

  // --- Business Group: child companies ------------------------------------
  // Schema-level parent/child hierarchy only (Company.isParent/parentCompanyId)
  // — there is no companyId column yet on Contract/Client/Contractor/Employee/
  // etc., and CompanyMembership is tenant-scoped, not company-scoped (see
  // memory: prd16-business-group-scalability). So these two child companies
  // are real rows with real branches, visible on the Company page, but every
  // other seeded record below still belongs to the tenant as a whole rather
  // than to one specific company in the hierarchy.
  const childCompanySeeds = [
    { name: "BuildCore Facilities", legalName: "BuildCore Facilities Sh.p.k.", branch: "Durrës Depot" },
    { name: "BuildCore Interiors", legalName: "BuildCore Interiors Sh.p.k.", branch: "Tirana Design Studio" },
  ];
  for (const c of childCompanySeeds) {
    const child = await db.company.create({
      data: {
        tenantId: tenant.id,
        name: c.name,
        legalName: c.legalName,
        countryCode: "AL",
        planName: "Enterprise",
        seatLimit: 20,
        parentCompanyId: company.id,
      },
    });
    await db.branch.create({ data: { companyId: child.id, name: c.branch, isRegisteredBranch: true } });
  }

  // --- Users -----------------------------------------------------------
  const users = await Promise.all(
    [
      { username: "arben.kola", email: "arben.kola@buildcore.com", displayName: "Arben Kola", color: "#B8863C" },
      { username: "elira.doda", email: "elira.doda@buildcore.com", displayName: "Elira Doda", color: "#4a3aa7" },
      { username: "gentian.hoxha", email: "gentian.hoxha@buildcore.com", displayName: "Gentian Hoxha", color: "#2457C5" },
      { username: "sara.mema", email: "sara.mema@buildcore.com", displayName: "Sara Mema", color: "#e87ba4" },
      { username: "besnik.lala", email: "besnik.lala@buildcore.com", displayName: "Besnik Lala", color: "#1A7F4E" },
      { username: "fatjon.dervishi", email: "fatjon.dervishi@buildcore.com", displayName: "Fatjon Dervishi", color: "#eb6834" },
      { username: "ana.krasniqi", email: "ana.krasniqi@buildcore.com", displayName: "Ana Krasniqi", color: "#1baf7a" },
    ].map(({ color, ...u }) => db.userIdentity.create({ data: { ...u, avatarColor: color, passwordHash } }))
  );
  const [arben, elira, gentian, sara, besnik, fatjon, ana] = users;

  await Promise.all([
    db.companyMembership.create({ data: { tenantId: tenant.id, userId: arben.id, role: "OWNER", department: "Management", position: "Company Owner" } }),
    db.companyMembership.create({ data: { tenantId: tenant.id, userId: elira.id, role: "ARCHITECT", department: "Design Team", position: "Lead Architect" } }),
    db.companyMembership.create({ data: { tenantId: tenant.id, userId: gentian.id, role: "PM", department: "Projects", position: "Project Manager" } }),
    db.companyMembership.create({ data: { tenantId: tenant.id, userId: sara.id, role: "ARCHITECT", department: "Design Team", position: "Architect" } }),
    db.companyMembership.create({ data: { tenantId: tenant.id, userId: besnik.id, role: "STOCK", department: "Construction", position: "Site Manager" } }),
    db.companyMembership.create({ data: { tenantId: tenant.id, userId: fatjon.id, role: "FINANCE", department: "Finance", position: "Finance Manager" } }),
    db.companyMembership.create({ data: { tenantId: tenant.id, userId: ana.id, role: "HR", department: "Human Resources", position: "HR Manager" } }),
  ]);

  await db.invitation.createMany({
    data: [
      { tenantId: tenant.id, email: "new.architect@buildcore.com", role: "ARCHITECT" },
      { tenantId: tenant.id, email: "pm@buildcore.com", role: "PM" },
      { tenantId: tenant.id, email: "site.manager@buildcore.com", role: "STOCK" },
    ],
  });

  // --- Projects ----------------------------------------------------------
  const projectSeeds = [
    { name: "Riverside Towers", clientName: "Riverside Holdings", location: "Tirana, Albania", budget: 4_200_000, contractValue: 4_500_000, status: "ON_TRACK", progressPct: 68 },
    { name: "Metro Mall", clientName: "Metro Retail Group", location: "Durrës, Albania", budget: 2_800_000, contractValue: 3_000_000, status: "ON_TRACK", progressPct: 54 },
    { name: "Green Valley Resort", clientName: "Green Valley SH.A", location: "Vlorë, Albania", budget: 1_900_000, contractValue: 2_100_000, status: "AT_RISK", progressPct: 37 },
    { name: "Skyline Apartments", clientName: "Skyline Developers", location: "Tirana, Albania", budget: 1_500_000, contractValue: 1_650_000, status: "DELAYED", progressPct: 24 },
  ];

  const projects = await Promise.all(
    projectSeeds.map((p, i) =>
      db.project.create({
        data: {
          tenantId: tenant.id,
          companyId: company.id,
          code: `PRJ-2026-${String(i + 1).padStart(6, "0")}`,
          ...p,
        },
      })
    )
  );
  const [riverside, metroMall, greenValley, skyline] = projects;

  await Promise.all(
    projects.map((p) =>
      db.projectMember.createMany({
        data: [
          { projectId: p.id, userId: gentian.id, roleOnProject: "Project Manager" },
          { projectId: p.id, userId: elira.id, roleOnProject: "Architect" },
        ],
      })
    )
  );

  // --- Tasks ---------------------------------------------------------------
  const taskSeeds: { title: string; projectId: string; status: string; priority: string; responsibleId: string }[] = [
    { title: "Facade material schedule review", projectId: riverside.id, status: "IN_PROGRESS", priority: "HIGH", responsibleId: elira.id },
    { title: "Structural inspection — Block A", projectId: riverside.id, status: "REVIEW", priority: "MEDIUM", responsibleId: besnik.id },
    { title: "Client floor-plan revision request", projectId: riverside.id, status: "TO_DO", priority: "MEDIUM", responsibleId: sara.id },
    { title: "MEP coordination set — Level 3", projectId: metroMall.id, status: "IN_PROGRESS", priority: "MEDIUM", responsibleId: elira.id },
    { title: "Retail unit handover checklist", projectId: metroMall.id, status: "COMPLETED", priority: "LOW", responsibleId: gentian.id },
    { title: "Landscape design package approval", projectId: greenValley.id, status: "NEEDS_REVISION", priority: "HIGH", responsibleId: sara.id },
    { title: "Foundation delay root-cause report", projectId: skyline.id, status: "OVERDUE", priority: "CRITICAL", responsibleId: gentian.id },
    { title: "Roof drain locations RFI response", projectId: skyline.id, status: "TO_DO", priority: "MEDIUM", responsibleId: elira.id },
  ];

  await Promise.all(
    taskSeeds.map((t, i) =>
      db.task.create({
        data: {
          tenantId: tenant.id,
          code: `TSK-2026-${String(i + 1).padStart(6, "0")}`,
          title: t.title,
          projectId: t.projectId,
          status: t.status,
          priority: t.priority,
          createdById: gentian.id,
          mainResponsibleId: t.responsibleId,
        },
      })
    )
  );

  // Seeded projects/tasks above use hand-assigned codes (not allocateNumber),
  // so the NumberSeries counters they'd otherwise bump start at 1 — without
  // this, the very first real "Create Project" in the UI collides with
  // PRJ-2026-000001 (the project code format includes the year, same as the
  // seed's hand-assigned codes, so they can collide exactly; TASK's format
  // omits the year so it never collides today, but is seeded here too for
  // correctness in case that config ever changes).
  await db.numberSeries.createMany({
    data: [
      { tenantId: tenant.id, entityType: "PROJECT", prefix: "PRJ", nextValue: projectSeeds.length + 1 },
      { tenantId: tenant.id, entityType: "TASK", prefix: "TSK", nextValue: taskSeeds.length + 1 },
    ],
  });

  // --- Finance ---------------------------------------------------------
  await db.financeAccount.createMany({
    data: [
      { tenantId: tenant.id, name: "Operating Account", type: "OPERATING", balance: 620_000 },
      { tenantId: tenant.id, name: "Payroll Account", type: "PAYROLL", balance: 210_000 },
      { tenantId: tenant.id, name: "Savings Account", type: "SAVINGS", balance: 400_000 },
      { tenantId: tenant.id, name: "Tax Account", type: "TAX", balance: 70_000 },
      { tenantId: tenant.id, name: "Petty Cash", type: "PETTY_CASH", balance: 5_000 },
    ],
  });

  const now = new Date();
  function daysAgo(n: number) {
    return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  }
  function daysFromNow(n: number) {
    return new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
  }
  function monthsAgo(n: number) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - n);
    return d;
  }

  const invoiceSeeds = [
    { number: "INV-2026-048", type: "INVOICE", description: "Progress billing — Riverside Towers", amount: 85_000, status: "PAID", projectId: riverside.id, issuedDate: daysAgo(2) },
    { number: "PAY-2026-031", type: "PAYMENT", description: "Payment to supplier", amount: -25_000, status: "COMPLETED", projectId: metroMall.id, issuedDate: daysAgo(3) },
    { number: "INV-2026-047", type: "INVOICE", description: "Progress billing — Green Valley Resort", amount: 65_000, status: "SENT", projectId: greenValley.id, issuedDate: daysAgo(3) },
    { number: "EXP-2026-018", type: "EXPENSE", description: "Employee salaries", amount: -120_000, status: "COMPLETED", projectId: null, issuedDate: daysAgo(4) },
    { number: "EXP-2026-017", type: "EXPENSE", description: "Material purchase", amount: -45_000, status: "COMPLETED", projectId: skyline.id, issuedDate: daysAgo(5) },
  ];

  // Spread additional invoices across the past several months so the cash-flow
  // trend chart has real month-over-month movement, not a single data point.
  for (let m = 5; m >= 0; m--) {
    invoiceSeeds.push(
      { number: `INV-2026-${100 + m}`, type: "INVOICE", description: `Monthly billing — ${[riverside, metroMall, greenValley, skyline][m % 4].name}`, amount: 60_000 + m * 8_000, status: "PAID", projectId: [riverside, metroMall, greenValley, skyline][m % 4].id, issuedDate: monthsAgo(m) },
      { number: `EXP-2026-${200 + m}`, type: "EXPENSE", description: "Monthly operating costs", amount: -(40_000 + m * 5_000), status: "COMPLETED", projectId: null, issuedDate: monthsAgo(m) }
    );
  }

  await Promise.all(
    invoiceSeeds.map((inv) =>
      db.invoice.create({
        data: {
          tenantId: tenant.id,
          number: inv.number,
          type: inv.type,
          description: inv.description,
          amount: inv.amount,
          status: inv.status,
          projectId: inv.projectId,
          issuedDate: inv.issuedDate,
        },
      })
    )
  );

  await Promise.all(
    [
      { number: "BILL-2026-011", description: "Supplier Payment", amount: -35_000, status: "PENDING", dueDate: daysAgo(1) },
      { number: "TAX-2026-005", description: "Tax Payment (VAT)", amount: -18_500, status: "PENDING", dueDate: daysFromNow(3) },
      { number: "BILL-2026-012", description: "Rent Payment", amount: -8_000, status: "PENDING", dueDate: daysFromNow(6) },
      { number: "BILL-2026-013", description: "Insurance Payment", amount: -12_000, status: "PENDING", dueDate: daysFromNow(8) },
    ].map((b) =>
      db.invoice.create({
        data: { tenantId: tenant.id, type: "BILL", ...b },
      })
    )
  );

  // --- HR ----------------------------------------------------------------
  const employeeSeeds = [
    { fullName: "Arben Kola", position: "Company Owner", department: "Management", hireDate: monthsAgo(30), userId: arben.id, color: "#B8863C" },
    { fullName: "Elira Doda", position: "Lead Architect", department: "Design Team", hireDate: monthsAgo(20), userId: elira.id, color: "#4a3aa7" },
    { fullName: "Gentian Hoxha", position: "Project Manager", department: "Projects", hireDate: monthsAgo(16), userId: gentian.id, color: "#2457C5" },
    { fullName: "Sara Mema", position: "Architect", department: "Design Team", hireDate: monthsAgo(3), userId: sara.id, color: "#e87ba4" },
    { fullName: "Besnik Lala", position: "Site Manager", department: "Construction", hireDate: monthsAgo(9), userId: besnik.id, color: "#1A7F4E" },
    { fullName: "Fatjon Dervishi", position: "Finance Manager", department: "Finance", hireDate: monthsAgo(12), userId: fatjon.id, color: "#eb6834" },
    { fullName: "Ana Krasniqi", position: "HR Manager", department: "Human Resources", hireDate: monthsAgo(14), userId: ana.id, color: "#1baf7a" },
    { fullName: "Drilon Meta", position: "Site Engineer", department: "Construction", hireDate: daysAgo(20), color: "#e34948", birthday: new Date(1990, 7, 12) },
    { fullName: "Klea Basha", position: "Quantity Surveyor", department: "Construction", hireDate: daysAgo(45), color: "#eda100", birthday: new Date(1988, 7, 20) },
    // Additional Design Team architects — HR-only records (no login), same
    // pattern as Drilon/Klea above, so the Employee directory has a full
    // architecture bench to browse/click through.
    { fullName: "Xhoana Prifti", position: "Senior Architect", department: "Design Team", hireDate: monthsAgo(28), color: "#7a4ac9", birthday: new Date(1985, 2, 14) },
    { fullName: "Redon Vata", position: "BIM Coordinator", department: "Design Team", hireDate: monthsAgo(18), color: "#2f9e8f", birthday: new Date(1991, 10, 3) },
    { fullName: "Megi Sokoli", position: "Interior Architect", department: "Design Team", hireDate: monthsAgo(11), color: "#c9578a", birthday: new Date(1993, 5, 22) },
    { fullName: "Ard Bushati", position: "Landscape Architect", department: "Design Team", hireDate: monthsAgo(7), color: "#5a8f3c", birthday: new Date(1989, 8, 9) },
    { fullName: "Enkeleda Rama", position: "Design Architect", department: "Design Team", hireDate: monthsAgo(5), color: "#d4863c", birthday: new Date(1994, 1, 27) },
    { fullName: "Blendi Cara", position: "Junior Architect", department: "Design Team", hireDate: daysAgo(60), color: "#3c6fd4", birthday: new Date(1996, 11, 15) },
  ];

  const employees = await Promise.all(
    employeeSeeds.map((e) =>
      db.employee.create({
        data: {
          tenantId: tenant.id,
          fullName: e.fullName,
          position: e.position,
          department: e.department,
          hireDate: e.hireDate,
          userId: e.userId,
          avatarColor: e.color,
          birthday: e.birthday,
        },
      })
    )
  );

  await db.leaveRequest.createMany({
    data: [
      { tenantId: tenant.id, employeeId: employees[3].id, startDate: daysFromNow(5), endDate: daysFromNow(10), status: "PENDING", reason: "Annual leave" },
      { tenantId: tenant.id, employeeId: employees[4].id, startDate: daysAgo(2), endDate: daysFromNow(2), status: "APPROVED", reason: "Sick leave" },
    ],
  });

  // --- Salary History — a CURRENT record per key employee, plus one
  // superseded PREVIOUS record to demonstrate history is preserved. ------
  await db.salaryRecord.createMany({
    data: [
      { tenantId: tenant.id, employeeId: employees[1].id, effectiveStartDate: monthsAgo(20), currency: "EUR", grossSalary: 3200, netSalary: 2400, paymentFrequency: "MONTHLY", status: "CURRENT", createdById: ana.id },
      { tenantId: tenant.id, employeeId: employees[2].id, effectiveStartDate: monthsAgo(16), currency: "EUR", grossSalary: 2800, netSalary: 2150, paymentFrequency: "MONTHLY", status: "CURRENT", createdById: ana.id },
      { tenantId: tenant.id, employeeId: employees[4].id, effectiveStartDate: monthsAgo(9), currency: "ALL", grossSalary: 180_000, netSalary: 145_000, paymentFrequency: "MONTHLY", status: "CURRENT", createdById: ana.id },
      { tenantId: tenant.id, employeeId: employees[5].id, effectiveStartDate: monthsAgo(12), currency: "EUR", grossSalary: 2600, netSalary: 2000, paymentFrequency: "MONTHLY", status: "CURRENT", createdById: ana.id },
      // Ana (HR Manager) — an earlier PREVIOUS raise superseded by the CURRENT one.
      { tenantId: tenant.id, employeeId: employees[6].id, effectiveStartDate: monthsAgo(14), effectiveEndDate: monthsAgo(6), currency: "EUR", grossSalary: 2200, netSalary: 1700, paymentFrequency: "MONTHLY", status: "PREVIOUS", createdById: ana.id },
      { tenantId: tenant.id, employeeId: employees[6].id, effectiveStartDate: monthsAgo(6), currency: "EUR", grossSalary: 2500, netSalary: 1920, paymentFrequency: "MONTHLY", status: "CURRENT", createdById: ana.id },
    ],
  });

  // --- HR calendar appointments -------------------------------------------
  await db.hrAppointment.createMany({
    data: [
      { tenantId: tenant.id, title: "Interview — Site Engineer", type: "INTERVIEW", candidateName: "Endrit Berisha", scheduledAt: daysFromNow(3), createdById: ana.id, notes: "Second-round technical interview." },
      { tenantId: tenant.id, title: "Interview — QA Inspector", type: "INTERVIEW", candidateName: "Mirela Cani", scheduledAt: daysFromNow(6), createdById: ana.id },
      { tenantId: tenant.id, title: "Quarterly HR Review", type: "INTERNAL", scheduledAt: daysFromNow(9), createdById: ana.id, notes: "Department heads sync on headcount planning." },
    ],
  });

  // --- Architecture: drawings & RFIs --------------------------------------
  await db.drawing.createMany({
    data: [
      { tenantId: tenant.id, projectId: riverside.id, packageName: "A1.0 — Overall Plans", discipline: "Architecture", revisionCode: "Rev. 3", status: "IN_REVIEW" },
      { tenantId: tenant.id, projectId: metroMall.id, packageName: "A2.3 — Floor Plans", discipline: "Architecture", revisionCode: "Rev. 2", status: "APPROVED" },
      { tenantId: tenant.id, projectId: skyline.id, packageName: "A5.1 — Elevations", discipline: "Architecture", revisionCode: "Rev. 4", status: "NEEDS_REVISION" },
      { tenantId: tenant.id, projectId: greenValley.id, packageName: "A0.1 — Cover Sheet", discipline: "Architecture", revisionCode: "Rev. 1", status: "DRAFT" },
      { tenantId: tenant.id, projectId: riverside.id, packageName: "S1.2 — Structural Plan", discipline: "Structural", revisionCode: "Rev. 2", status: "APPROVED" },
      { tenantId: tenant.id, projectId: metroMall.id, packageName: "M1.0 — MEP Coordination", discipline: "MEP", revisionCode: "Rev. 1", status: "IN_REVIEW" },
    ],
  });

  await db.rFI.createMany({
    data: [
      { tenantId: tenant.id, projectId: riverside.id, code: "RFI-023", title: "Stair guard height", status: "OPEN", dueDate: daysFromNow(2) },
      { tenantId: tenant.id, projectId: metroMall.id, code: "RFI-022", title: "Window type clarification", status: "ANSWERED" },
      { tenantId: tenant.id, projectId: skyline.id, code: "RFI-021", title: "Roof drain locations", status: "OPEN", dueDate: daysAgo(1) },
      { tenantId: tenant.id, projectId: greenValley.id, code: "RFI-020", title: "Door hardware specs", status: "ANSWERED" },
    ],
  });

  // --- Teams ---------------------------------------------------------------
  const designTeam = await db.team.create({
    data: { tenantId: tenant.id, name: "Design Team", description: "Architecture and drawing production." },
  });
  const siteOpsTeam = await db.team.create({
    data: { tenantId: tenant.id, name: "Site Operations", description: "On-site execution and supervision." },
  });
  await db.teamMember.createMany({
    data: [
      { teamId: designTeam.id, userId: elira.id },
      { teamId: designTeam.id, userId: sara.id },
      { teamId: siteOpsTeam.id, userId: besnik.id },
      { teamId: siteOpsTeam.id, userId: gentian.id },
    ],
  });

  // --- Contractors & Contracts ---------------------------------------------
  const contractorSeeds = [
    { name: "Elektro Al Shpk", tradeType: "Electrical", email: "info@elektroal.al", status: "APPROVED", riskRating: "LOW" },
    { name: "HidroPlumb Sh.p.k.", tradeType: "Plumbing", email: "contact@hidroplumb.al", status: "APPROVED", riskRating: "LOW" },
    { name: "Metal Frame Construction", tradeType: "Structural Steel", email: "office@metalframe.al", status: "PENDING", riskRating: "MEDIUM" },
    { name: "KlimaTek HVAC Sh.p.k.", tradeType: "HVAC", email: "info@klimatek.al", status: "APPROVED", riskRating: "LOW" },
    { name: "Çati e Sigurt Roofing", tradeType: "Roofing", email: "office@catisigurt.al", status: "APPROVED", riskRating: "MEDIUM" },
    { name: "VitroFasada Glazing", tradeType: "Glazing & Curtain Wall", email: "contact@vitrofasada.al", status: "PENDING", riskRating: "MEDIUM" },
    { name: "Gjelbërim Peizazh", tradeType: "Landscaping", email: "info@gjelberimpeizazh.al", status: "APPROVED", riskRating: "LOW" },
    { name: "FinishPro Painting & Finishes", tradeType: "Painting & Finishes", email: "office@finishpro.al", status: "APPROVED", riskRating: "LOW" },
    { name: "SkelaSafe Scaffolding", tradeType: "Scaffolding", email: "contact@skelasafe.al", status: "SUSPENDED", riskRating: "HIGH" },
    { name: "FireGuard Systems Al", tradeType: "Fire Safety Systems", email: "info@fireguardal.al", status: "APPROVED", riskRating: "MEDIUM" },
    { name: "Prishje Enterprise Demolition", tradeType: "Demolition", email: "office@prishjeenterprise.al", status: "PENDING", riskRating: "HIGH" },
    { name: "Beton Themel Foundations", tradeType: "Concrete & Foundations", email: "contact@betonthemel.al", status: "APPROVED", riskRating: "LOW" },
    { name: "AscensorLift Elevators", tradeType: "Elevators & Lifts", email: "info@ascensorlift.al", status: "APPROVED", riskRating: "MEDIUM" },
    { name: "HidroIzolim Waterproofing", tradeType: "Waterproofing", email: "office@hidroizolim.al", status: "APPROVED", riskRating: "LOW" },
    { name: "Murator Tradition Masonry", tradeType: "Masonry", email: "contact@muratortradition.al", status: "PENDING", riskRating: "MEDIUM" },
  ];
  // Sequential (not Promise.all) — allocateSeedNumber's read-then-write isn't
  // wrapped in a transaction here, so concurrent calls for the same
  // entityType would race on the NumberSeries upsert.
  const contractors = [];
  for (const c of contractorSeeds) {
    const number = await allocateSeedNumber(tenant.id, "CONTRACTOR");
    contractors.push(await db.contractor.create({ data: { tenantId: tenant.id, number, ...c } }));
  }
  const [elektro, hidroplumb, metalFrame] = contractors;

  const contractSeeds = [
    { title: "Electrical Installation — Riverside Towers", value: 240_000, projectId: riverside.id, contractorId: elektro.id, status: "ACTIVE", startDate: monthsAgo(4), endDate: daysFromNow(90) },
    { title: "Plumbing Works — Metro Mall", value: 180_000, projectId: metroMall.id, contractorId: hidroplumb.id, status: "ACTIVE", startDate: monthsAgo(2), endDate: daysFromNow(120) },
    { title: "Structural Steel Frame — Skyline Apartments", value: 310_000, projectId: skyline.id, contractorId: metalFrame.id, status: "DRAFT", startDate: daysFromNow(14), endDate: daysFromNow(300) },
  ];
  for (const c of contractSeeds) {
    const number = await allocateSeedNumber(tenant.id, "CONTRACT");
    await db.contract.create({ data: { tenantId: tenant.id, number, currency: "EUR", ...c } });
  }

  // --- Clients ---------------------------------------------------------------
  const clientSeeds: { name: string; contactName: string; email: string; phone: string; createdById: string; status?: string; project?: (typeof projects)[number] }[] = [
    { name: "Riverside Holdings", contactName: "Mira Basha", email: "mira@riversideholdings.al", phone: "+355 69 200 1122", createdById: gentian.id, project: riverside },
    { name: "Metro Retail Group", contactName: "Dritan Hoxha", email: "dritan@metroretail.al", phone: "+355 69 200 3344", createdById: gentian.id, project: metroMall },
    { name: "Green Valley SH.A", contactName: "Ledia Prifti", email: "ledia@greenvalley.al", phone: "+355 69 200 5566", createdById: gentian.id, project: greenValley },
    { name: "Skyline Developers", contactName: "Arjan Sula", email: "arjan@skylinedev.al", phone: "+355 69 200 7788", createdById: gentian.id, project: skyline },
    { name: "Adriatik Logistics Sh.p.k.", contactName: "Blerina Kastrati", email: "blerina@adriatiklogistics.al", phone: "+355 69 300 1111", createdById: gentian.id, status: "PROSPECT" },
    { name: "Tirana Business Park", contactName: "Ermal Gjoka", email: "ermal@tbp.al", phone: "+355 69 300 2222", createdById: gentian.id, status: "PROSPECT" },
    { name: "Kastrioti Hotels Group", contactName: "Anisa Leka", email: "anisa@kastriotihotels.al", phone: "+355 69 300 3333", createdById: gentian.id, status: "ACTIVE" },
    { name: "Vjosa Residential Sh.p.k.", contactName: "Fatos Ndoja", email: "fatos@vjosaresidential.al", phone: "+355 69 300 4444", createdById: gentian.id, status: "ACTIVE" },
    { name: "Durrës Port Authority", contactName: "Silvana Meta", email: "silvana@durrresport.al", phone: "+355 69 300 5555", createdById: gentian.id, status: "ACTIVE" },
    { name: "Alpina Ski Resorts", contactName: "Genci Toska", email: "genci@alpinaski.al", phone: "+355 69 300 6666", createdById: gentian.id, status: "PROSPECT" },
    { name: "Ionian Coast Developments", contactName: "Rudina Ismaili", email: "rudina@ioniancoast.al", phone: "+355 69 300 7777", createdById: gentian.id, status: "ACTIVE" },
    { name: "Prishtina Retail Partners", contactName: "Valon Krasniqi", email: "valon@prishtinaretail.com", phone: "+383 44 100 8888", createdById: gentian.id, status: "PROSPECT" },
    { name: "Elbasan Industrial Park", contactName: "Doriana Shehu", email: "doriana@elbasanindustrial.al", phone: "+355 69 300 9999", createdById: gentian.id, status: "INACTIVE" },
    { name: "Korça Heritage Trust", contactName: "Petrit Manoku", email: "petrit@korcaheritage.al", phone: "+355 69 301 1010", createdById: gentian.id, status: "INACTIVE" },
  ];
  const clients = [];
  for (const c of clientSeeds) {
    const { project, status, ...clientData } = c;
    clients.push(
      await db.client.create({
        data: {
          tenantId: tenant.id,
          ...clientData,
          status: status ?? "ACTIVE",
          ...(project ? { projects: { connect: { id: project.id } } } : {}),
        },
      })
    );
  }
  const [riversideClient] = clients;

  await db.comment.create({
    data: {
      tenantId: tenant.id,
      authorId: gentian.id,
      targetType: "Client",
      targetId: riversideClient.id,
      body: "Client requested an accelerated facade delivery schedule — coordinating with the design team.",
    },
  });

  // --- Documents -------------------------------------------------------------
  await db.documentFile.createMany({
    data: [
      { tenantId: tenant.id, projectId: riverside.id, name: "Riverside Towers — Structural Calculations.pdf", category: "Engineering", version: 2, status: "APPROVED", uploadedById: elira.id },
      { tenantId: tenant.id, projectId: riverside.id, name: "Site Safety Plan.pdf", category: "HSE", version: 1, status: "SUBMITTED", uploadedById: besnik.id },
      { tenantId: tenant.id, projectId: metroMall.id, name: "MEP Coordination Set.pdf", category: "Engineering", version: 3, status: "APPROVED", uploadedById: elira.id },
      { tenantId: tenant.id, projectId: skyline.id, name: "Client Handover Checklist.docx", category: "General", version: 1, status: "DRAFT", uploadedById: gentian.id },
    ],
  });

  // --- Meetings ----------------------------------------------------------
  await db.meeting.createMany({
    data: [
      { tenantId: tenant.id, projectId: riverside.id, title: "Weekly Site Coordination", scheduledAt: daysAgo(3), location: "Site Office — Tirana", organiserId: gentian.id, status: "HELD", notes: "Reviewed facade delivery schedule; no blockers." },
      { tenantId: tenant.id, projectId: metroMall.id, title: "MEP Design Review", scheduledAt: daysFromNow(2), location: "HQ Meeting Room 2", organiserId: elira.id, status: "PLANNED" },
      { tenantId: tenant.id, projectId: skyline.id, title: "Delay Root-Cause Review", scheduledAt: daysFromNow(1), location: "Video Call", organiserId: gentian.id, status: "PLANNED" },
    ],
  });

  // --- Assets --------------------------------------------------------------
  const heavyEquipment = await db.assetCategory.create({ data: { tenantId: tenant.id, code: "HEAVY-EQUIPMENT", name: "Heavy Equipment", description: "Cranes, excavators and heavy site machinery.", depreciationMethod: "STRAIGHT_LINE", usefulLifeMonths: 120, inspectionIntervalDays: 30, maintenanceIntervalDays: 90 } });
  const surveyTools = await db.assetCategory.create({ data: { tenantId: tenant.id, code: "SURVEY", name: "Survey Instruments", description: "Precision measurement and setting-out equipment.", depreciationMethod: "STRAIGHT_LINE", usefulLifeMonths: 60, inspectionIntervalDays: 180, maintenanceIntervalDays: 180 } });
  const towerCrane = await db.asset.create({ data: { tenantId: tenant.id, projectId: riverside.id, categoryId: heavyEquipment.id, code: "AST-00001", name: "Tower Crane TC-4810", type: "EQUIPMENT", status: "ASSIGNED", ownershipCompanyId: company.id, ownershipCompanyName: company.name, manufacturer: "Liebherr", model: "4810", serialNumber: "TC4810-BC-01", qrCode: "AST-00001", barcode: "AST-00001", purchaseDate: new Date("2023-03-15"), purchaseValue: 180_000, bookValue: 124_500, usefulLifeMonths: 120, salvageValue: 18_000, currentLocation: "Riverside Towers · Tower A", condition: "GOOD", riskLevel: "HIGH", createdById: arben.id } });
  await db.asset.createMany({ data: [
    { tenantId: tenant.id, projectId: metroMall.id, categoryId: heavyEquipment.id, code: "AST-00002", name: "Concrete Mixer Truck", type: "VEHICLE", status: "ASSIGNED", ownershipCompanyId: company.id, ownershipCompanyName: company.name, manufacturer: "Mercedes-Benz", purchaseValue: 95_000, bookValue: 61_750, currentLocation: "Metro Mall Site", qrCode: "AST-00002", condition: "GOOD", createdById: arben.id },
    { tenantId: tenant.id, categoryId: surveyTools.id, code: "AST-00003", name: "Total Station Surveying Kit", type: "TOOL", status: "ACTIVE", ownershipCompanyId: company.id, ownershipCompanyName: company.name, manufacturer: "Leica", model: "TS16", purchaseValue: 12_000, bookValue: 8_400, currentLocation: "Tirana HQ Equipment Store", qrCode: "AST-00003", condition: "EXCELLENT", createdById: arben.id },
  ] });
  const cranePlan = await db.assetMaintenance.create({ data: { tenantId: tenant.id, assetId: towerCrane.id, type: "PREVENTIVE", title: "Quarterly crane preventive maintenance", recurrenceRule: "FREQ=MONTHLY;INTERVAL=3", nextDueAt: daysFromNow(12), estimatedCost: 2_400, createdById: besnik.id } });
  await db.assetWorkOrder.create({ data: { tenantId: tenant.id, assetId: towerCrane.id, maintenanceId: cranePlan.id, number: "AWO-2026-000001", title: "Quarterly slewing and hoist inspection", priority: "HIGH", status: "ASSIGNED", slaDueAt: daysFromNow(12), scheduledStart: daysFromNow(10), technicianName: "Ardit Mechanical Services", createdById: besnik.id } });
  await db.assetAssignment.create({ data: { tenantId: tenant.id, assetId: towerCrane.id, assigneeType: "PROJECT", assigneeId: riverside.id, assigneeName: riverside.name, projectId: riverside.id, location: "Tower A crane base", assignedAt: new Date("2026-04-01"), conditionOut: "GOOD", createdById: gentian.id } });
  await db.assetInspection.create({ data: { tenantId: tenant.id, assetId: towerCrane.id, templateName: "Monthly lifting equipment inspection", inspectionType: "SAFETY", inspectedAt: daysAgo(18), inspectorName: "Site HSE Team", result: "PASSED", findings: "No critical findings.", nextDueAt: daysFromNow(12), createdById: besnik.id } });
  await db.assetInsurancePolicy.create({ data: { tenantId: tenant.id, assetId: towerCrane.id, provider: "SIGAL", policyNumber: "PL-CPE-2026-4810", coverage: "Plant, machinery and third-party liability", insuredValue: 180_000, startsAt: new Date("2026-01-01"), expiresAt: new Date("2026-12-31"), createdAt: new Date() } });
  await db.assetActivity.createMany({ data: [{ tenantId: tenant.id, assetId: towerCrane.id, eventType: "asset.created", summary: "AST-00001 Tower Crane TC-4810 created.", actorId: arben.id, correlationId: "seed-asset-created" }, { tenantId: tenant.id, assetId: towerCrane.id, eventType: "asset.assigned", summary: "Tower crane assigned to Riverside Towers.", actorId: gentian.id, previousStatus: "ACTIVE", nextStatus: "ASSIGNED", correlationId: "seed-asset-assigned" }] });

  // --- Tenant settings -------------------------------------------------------
  await db.tenantSettings.create({
    data: { tenantId: tenant.id, defaultCurrency: "EUR", dateFormat: "DD/MM/YYYY", timeFormat: "24H", calendarDefault: "MONTH" },
  });

  // --- HSE reports -------------------------------------------------------
  await db.hseReport.createMany({
    data: [
      { tenantId: tenant.id, projectId: riverside.id, title: "Exposed rebar near stairwell", description: "Uncapped rebar found near the east stairwell on level 3 — trip and impalement hazard.", severity: "HIGH", status: "OPEN", reportedById: besnik.id },
      { tenantId: tenant.id, projectId: metroMall.id, title: "Missing guardrail — Level 2 edge", description: "Guardrail section missing along the north edge of the level 2 slab.", severity: "CRITICAL", status: "IN_PROGRESS", reportedById: besnik.id },
      { tenantId: tenant.id, projectId: skyline.id, title: "Blocked fire exit", description: "Stored materials partially blocking the ground-floor fire exit route.", severity: "MEDIUM", status: "RESOLVED", reportedById: besnik.id },
    ],
  });

  // --- Procurement: suppliers & purchase orders ---------------------------
  const supplierSeeds = [
    { name: "SteelWorks Albania", category: "Steel" },
    { name: "Beton Elite Sh.p.k.", category: "Concrete" },
    { name: "ElectroSupply Tirana", category: "Electrical" },
  ];
  const suppliers = [];
  for (const s of supplierSeeds) {
    const number = await allocateSeedNumber(tenant.id, "SUPPLIER");
    suppliers.push(await db.supplier.create({ data: { tenantId: tenant.id, companyId: company.id, number, status: "QUALIFIED", qualificationStatus: "QUALIFIED", overallScore: 82, ...s } }));
  }
  const [steelworks, betonElite, electroSupply] = suppliers;

  const purchaseOrderSeeds = [
    { supplierId: steelworks.id, projectId: riverside.id, description: "Structural steel — Block A frame", amount: 145_000, status: "ORDERED" },
    { supplierId: betonElite.id, projectId: metroMall.id, description: "Ready-mix concrete — foundation pour", amount: 62_000, status: "SUBMITTED" },
    { supplierId: electroSupply.id, projectId: skyline.id, description: "MEP electrical rough-in materials", amount: 28_500, status: "DRAFT" },
  ];
  for (const po of purchaseOrderSeeds) {
    const number = await allocateSeedNumber(tenant.id, "PURCHASE_ORDER");
    await db.purchaseOrder.create({ data: { tenantId: tenant.id, companyId: company.id, number, currency: "EUR", requestedById: gentian.id, subtotal: po.amount, ...po } });
  }

  // --- Suggestions -----------------------------------------------------------
  await db.suggestion.create({
    data: { tenantId: tenant.id, userId: gentian.id, message: "It would help to get a mobile push notification when a task I'm responsible for becomes overdue." },
  });

  // --- Per-role test accounts ------------------------------------------------
  // One account per entry in lib/constants.ts ROLES, for quickly testing what
  // each permission tier can see — not meant to look like real staff (see the
  // named seed users above for that). Username/display name is the role in
  // title case (e.g. "CEO" -> "Ceo"), password is "1" for every one of them.
  const TEST_ACCOUNT_PASSWORD = "1";
  const testAccountPasswordHash = await bcrypt.hash(TEST_ACCOUNT_PASSWORD, 10);
  const testAccountColors = ["#B8863C", "#4a3aa7", "#2457C5", "#e87ba4", "#1A7F4E", "#eb6834", "#1baf7a", "#e34948"];

  function titleCase(role: string) {
    return role.charAt(0) + role.slice(1).toLowerCase();
  }

  for (let i = 0; i < ROLES.length; i++) {
    const role = ROLES[i];
    const name = titleCase(role);
    const user = await db.userIdentity.create({
      data: {
        username: name,
        email: name.toLowerCase(),
        displayName: name,
        avatarColor: testAccountColors[i % testAccountColors.length],
        passwordHash: testAccountPasswordHash,
      },
    });
    await db.companyMembership.create({
      data: { tenantId: tenant.id, userId: user.id, role, department: "Testing", position: `${name} Test Account` },
    });
  }

  // --- Platform Admin test accounts -------------------------------------
  // The codebase today only has one platform-level gate — UserIdentity.
  // isPlatformAdmin, a single boolean checked by src/app/platform/applications
  // (PRD_6's "minimal Platform Admin" scope). There is no PlatformRole /
  // PlatformPermission / Super-vs-regular distinction actually enforced
  // anywhere yet — that split is PRD_7's fuller, unbuilt scope (see memory:
  // prd16/PRD_7 note). Both accounts below get the same isPlatformAdmin=true
  // flag and therefore identical real capability today; they're seeded
  // as two separate logins so the naming is ready once that distinction
  // gets built, not because two different access levels exist yet.
  const platformAdminSeeds = [
    { username: "SuperPlatformAdmin", displayName: "Super Platform Admin", color: "#0f172a" },
    { username: "PlatformAdmin", displayName: "Platform Admin", color: "#334155" },
  ];
  for (const p of platformAdminSeeds) {
    const user = await db.userIdentity.create({
      data: {
        username: p.username,
        email: p.username.toLowerCase(),
        displayName: p.displayName,
        avatarColor: p.color,
        passwordHash: testAccountPasswordHash,
        isPlatformAdmin: true,
      },
    });
    await db.companyMembership.create({
      data: { tenantId: tenant.id, userId: user.id, role: "VIEWER", department: "Platform", position: p.displayName },
    });
  }

  // --- Super user test account --------------------------------------------
  // username "1" / password "1" for quick manual testing. Combines OWNER
  // (FULL_ADMIN on every PERMISSION_MATRIX resource, so every in-tenant
  // module shows in the sidebar) with isPlatformAdmin: true (cross-tenant
  // /platform/applications access) — the broadest access the current
  // permission model can express for a single account.
  const superUser = await db.userIdentity.create({
    data: {
      username: "1",
      email: "1",
      displayName: "Super User",
      avatarColor: "#dc2626",
      passwordHash: testAccountPasswordHash,
      isPlatformAdmin: true,
    },
  });
  await db.companyMembership.create({
    data: { tenantId: tenant.id, userId: superUser.id, role: "OWNER", department: "Testing", position: "Super User Test Account" },
  });

  // --- Work Progress and Site Operations ----------------------------------
  const workPackage = await db.workPackage.create({ data: { tenantId: tenant.id, companyId: company.id, projectId: riverside.id, code: "WP-000001", name: "Tower A concrete frame", description: "Columns, cores, beams and suspended slabs for Tower A levels 12-16.", discipline: "Structural", location: "Tower A · Levels 12-16", contractorName: "BuildCore Structures", accountableOwnerId: gentian.id, measurementMethod: "INSTALLED_QUANTITY", unit: "m3", approvedQuantity: 1250, acceptedQuantity: 510, weight: 1, plannedStart: new Date("2026-06-01"), plannedFinish: new Date("2026-09-30"), forecastFinish: new Date("2026-10-08"), status: "IN_PROGRESS", readinessStatus: "READY", qualityGateStatus: "CLEAR", hseGateStatus: "CLEAR", createdById: gentian.id } });
  const baseline = await db.workScheduleVersion.create({ data: { tenantId: tenant.id, companyId: company.id, projectId: riverside.id, name: "Contract Baseline", version: 1, type: "ORIGINAL_BASELINE", status: "ACTIVE_BASELINE", dataDate: new Date("2026-08-05"), baselineAt: new Date("2026-05-20"), checksum: "seed-baseline-v1", createdById: gentian.id } });
  await db.workScheduleActivity.create({ data: { tenantId: tenant.id, projectId: riverside.id, scheduleVersionId: baseline.id, workPackageId: workPackage.id, code: "STR-A-120", name: "Tower A frame levels 12-16", plannedStart: new Date("2026-06-01"), plannedFinish: new Date("2026-09-30"), forecastFinish: new Date("2026-10-08"), durationDays: 86, progressPct: 40.8, totalFloatDays: -6, isCritical: true, status: "IN_PROGRESS" } });
  const progressUpdate = await db.workProgressUpdate.create({ data: { tenantId: tenant.id, projectId: riverside.id, workPackageId: workPackage.id, baselineId: baseline.id, idempotencyKey: "seed-work-progress-001", updateNumber: "WPU-2026-000001", method: "INSTALLED_QUANTITY", periodQuantity: 510, unit: "m3", effectiveAt: new Date("2026-08-04"), location: "Tower A · Level 12", notes: "Accepted concrete quantities through level 12 slab.", status: "ACCEPTED", submittedAt: new Date("2026-08-04T16:00:00Z"), verifiedAt: new Date("2026-08-05T07:00:00Z"), acceptedAt: new Date("2026-08-05T07:10:00Z"), createdById: besnik.id, verifiedById: gentian.id } });
  await db.dailySiteReport.create({ data: { tenantId: tenant.id, companyId: company.id, projectId: riverside.id, reportNumber: "DSR-2026-00001", reportDate: new Date("2026-08-04"), shift: "DAY", weather: "Clear, 31°C, light wind", siteConditions: "Dry access and working platforms.", workforceJson: "Structural crew: 34 people, 278 logged hours, 242 productive hours", equipmentJson: "Tower crane 9.5h; concrete pump 6.2h; no unplanned downtime", workCompleted: "Level 12 slab pour and core wall preparation.", deliveriesJson: "Concrete 112 m3 received against PO; all accepted.", issues: "Late reinforcement inspection compressed the pour window.", qualityNotes: "Slump and cube tests accepted; inspection reference retained externally.", hseNotes: "Toolbox talk completed; no incidents or stop-work events.", nextShiftPlan: "Strip slab edges and begin Level 13 columns.", accountableOwnerId: gentian.id, status: "VERIFIED", submittedAt: new Date("2026-08-04T18:00:00Z"), verifiedAt: new Date("2026-08-05T07:00:00Z"), createdById: besnik.id } });
  await db.workConstraint.create({ data: { tenantId: tenant.id, companyId: company.id, projectId: riverside.id, workPackageId: workPackage.id, number: "CNS-2026-00001", title: "Level 13 reinforcement drawing release", category: "DRAWING", description: "Construction issue revision is required before reinforcement cutting continues.", impact: "Blocks Level 13 column reinforcement and threatens the critical frame cycle.", ownerId: elira.id, requiredBy: new Date("2026-08-07"), status: "ASSIGNED", createdById: gentian.id } });
  await db.workProgressEvidence.create({ data: { tenantId: tenant.id, projectId: riverside.id, workPackageId: workPackage.id, progressUpdateId: progressUpdate.id, type: "PHOTO", title: "Tower A Level 12 completed slab", location: "Tower A · Level 12 · Grid A-D", capturedAt: new Date("2026-08-04T15:40:00Z"), checksum: "seed-evidence-sha256", annotationJson: JSON.stringify({ caption: "Completed pour extent", orientation: "NE" }), confidentiality: "PROJECT", createdById: besnik.id } });
  await db.workProgressActivity.createMany({ data: [{ tenantId: tenant.id, projectId: riverside.id, entityType: "WORK_PACKAGE", entityId: workPackage.id, eventType: "work_package.created", summary: "WP-000001 Tower A concrete frame created.", actorId: gentian.id, correlationId: "seed-wp-create" }, { tenantId: tenant.id, projectId: riverside.id, entityType: "PROGRESS_UPDATE", entityId: progressUpdate.id, eventType: "progress_update.accepted", summary: "510 m3 accepted for WP-000001.", actorId: gentian.id, previousStatus: "UNDER_VERIFICATION", nextStatus: "ACCEPTED", correlationId: "seed-wp-accept" }] });

  // --- Audit / notifications ----------------------------------------------
  await db.auditEvent.createMany({
    data: [
      { tenantId: tenant.id, actorId: arben.id, action: "USER_CREATED", targetType: "UserIdentity", targetId: elira.id, metadata: JSON.stringify({ role: "ARCHITECT" }) },
      { tenantId: tenant.id, actorId: arben.id, action: "ROLE_UPDATED", targetType: "CompanyMembership", targetId: besnik.id },
      { tenantId: tenant.id, actorId: arben.id, action: "ACCESS_REVOKED", targetType: "UserIdentity" },
      { tenantId: tenant.id, actorId: arben.id, action: "INVITATION_SENT", targetType: "Invitation" },
    ],
  });

  await db.notification.createMany({
    data: [
      { tenantId: tenant.id, userId: arben.id, type: "USER_CREATED", title: "New user created", body: "Elira Doda was added as Architect" },
      { tenantId: tenant.id, userId: arben.id, type: "TASK_OVERDUE", title: "Task overdue", body: "Foundation delay root-cause report is overdue" },
      { tenantId: tenant.id, userId: arben.id, type: "INVOICE_OVERDUE", title: "Invoice overdue", body: "Supplier Payment (€35,000) is overdue" },
    ],
  });

  console.log("Seed complete.");
  console.log(`Demo login → username: arben.kola  password: ${DEMO_PASSWORD}`);
  console.log("Other seeded logins: elira.doda (Architect), fatjon.dervishi (Finance), ana.krasniqi (HR) — same password.");
  console.log(`Per-role test logins (password "${TEST_ACCOUNT_PASSWORD}" for all): ${ROLES.map(titleCase).join(", ")}`);
  console.log(`Super user login → username: 1  password: 1 (OWNER + isPlatformAdmin, all modules)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
