require('dotenv').config()

const prisma = require("../../lib/client");

async function main() {

  // ── Tenants ───────────────────────────────────────────────
  const ngo1 = await prisma.tenant.upsert({
    where:  { slug: "caritas-kenya" },
    update: {},
    create: { name: "Caritas Kenya", slug: "caritas-kenya" }
  });

  const ngo2 = await prisma.tenant.upsert({
    where:  { slug: "jrs" },
    update: {},
    create: { name: "Jesuit Refugee Service", slug: "jrs" }
  });

  // ── Roles ─────────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where:  { tenantId_name: { tenantId: ngo1.id, name: "admin" } },
    update: {},
    create: { name: "admin", tenantId: ngo1.id }
  });

  const memberRole = await prisma.role.upsert({
    where:  { tenantId_name: { tenantId: ngo1.id, name: "member" } },
    update: {},
    create: { name: "member", tenantId: ngo1.id }
  });

  // ── User ──────────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where:  { email: "admin@caritas-kenya.org" },
    update: {},
    create: {
      email:    "admin@caritas-kenya.org",
      name:     "John Kamau",
      password: "$2b$10$m71wb4uQtzugm/GHe/pFouqDe9sShmCHOpJuUfjw2Pg3mLJuYGC.q",
      tenantId: ngo1.id,
    }
  });

  // ── UserRole ──────────────────────────────────────────────
  await prisma.userRole.upsert({
    where:  { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id }
  });

  // ── Project ───────────────────────────────────────────────
  const project = await prisma.project.upsert({
    where:  { id: 'seed-project-water-access' },
    update: {},
    create: {
      id:          'seed-project-water-access',
      name:        "Water Access Program",
      description: "Rural borehole construction",
      budget:      500000,
      tenantId:    ngo1.id
    }
  });

  // ── Funding Sources ───────────────────────────────────────
  const grant = await prisma.fundingSource.upsert({
    where:  { id: 'seed-funding-eu-grant' },
    update: {},
    create: {
      id:          'seed-funding-eu-grant',
      name:        "EU Grant",
      fundingType: "grant",
      amount:      200000,
      currency:    "EUR",
      projectId:   project.id,
      tenantId:    ngo1.id
    }
  });

  await prisma.fundingSource.upsert({
    where:  { id: 'seed-funding-lcbc-loan' },
    update: {},
    create: {
      id:          'seed-funding-lcbc-loan',
      name:        "LCBC Impact Loan",
      fundingType: "impact_loan",
      amount:      150000,
      currency:    "USD",
      projectId:   project.id,
      tenantId:    ngo1.id
    }
  });

  await prisma.fundingSource.upsert({
    where:  { id: 'seed-funding-catholic-fund' },
    update: {},
    create: {
      id:          'seed-funding-catholic-fund',
      name:        "Catholic Impact Fund",
      fundingType: "impact_investment",
      amount:      150000,
      currency:    "USD",
      projectId:   project.id,
      tenantId:    ngo1.id
    }
  });

  // ── Expense ───────────────────────────────────────────────
  await prisma.expense.upsert({
    where:  { id: 'seed-expense-drilling' },
    update: {},
    create: {
      id:             'seed-expense-drilling',
      description:    "Drilling equipment",
      amount:         20000,
      currency:       "USD",
      projectId:      project.id,
      fundingSourceId:grant.id,
      tenantId:       ngo1.id
    }
  });

  // ── AuditLog ──────────────────────────────────────────────
  await prisma.auditLog.upsert({
    where:  { id: 'seed-audit-project-create' },
    update: {},
    create: {
      id:         'seed-audit-project-create',
      action:     "CREATE",
      entityType: "Project",
      entityId:   project.id,
      userId:     user.id,
      tenantId:   ngo1.id
    }
  });

  console.log("✅ Seed data created successfully");
  console.log(`   → Tenants: Caritas Kenya, Jesuit Refugee Service`);
  console.log(`   → User: admin@caritas-kenya.org (admin role)`);
  console.log(`   → Project: Water Access Program`);
  console.log(`   → Funding: EU Grant + LCBC Loan + Catholic Impact Fund`);
  console.log(`   → Expense: Drilling equipment ($20,000)`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
