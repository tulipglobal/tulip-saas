require('dotenv').config()

const prisma = require("../../lib/client");

async function main() {

  // Create Tenants
  const ngo1 = await prisma.tenant.create({
    data: {
      name: "Caritas Kenya",
      slug: "caritas-kenya"
    }
  });

  const ngo2 = await prisma.tenant.create({
    data: {
      name: "Jesuit Refugee Service",
      slug: "jrs"
    }
  });

  // Create Roles for ngo1
  const adminRole = await prisma.role.create({
    data: {
      name: "admin",
      tenantId: ngo1.id
    }
  });

  const memberRole = await prisma.role.create({
    data: {
      name: "member",
      tenantId: ngo1.id
    }
  });

  // Create User for ngo1
  const user = await prisma.user.create({
    data: {
      email: "admin@caritas-kenya.org",
      name: "John Kamau",
      password: "$2b$10$m71wb4uQtzugm/GHe/pFouqDe9sShmCHOpJuUfjw2Pg3mLJuYGC.q",
      tenantId: ngo1.id,
      roles: {
        create: {
          roleId: adminRole.id
        }
      }
    }
  });

  // Create Project
  const project = await prisma.project.create({
    data: {
      name: "Water Access Program",
      description: "Rural borehole construction",
      budget: 500000,
      tenantId: ngo1.id
    }
  });

  // Create Funding Sources
  const grant = await prisma.fundingSource.create({
    data: {
      name: "EU Grant",
      fundingType: "grant",
      amount: 200000,
      currency: "EUR",
      projectId: project.id,
      tenantId: ngo1.id
    }
  });

  const loan = await prisma.fundingSource.create({
    data: {
      name: "LCBC Impact Loan",
      fundingType: "impact_loan",
      amount: 150000,
      currency: "USD",
      projectId: project.id,
      tenantId: ngo1.id
    }
  });

  const investment = await prisma.fundingSource.create({
    data: {
      name: "Catholic Impact Fund",
      fundingType: "impact_investment",
      amount: 150000,
      currency: "USD",
      projectId: project.id,
      tenantId: ngo1.id
    }
  });

  // Create Expense
  await prisma.expense.create({
    data: {
      description: "Drilling equipment",
      amount: 20000,
      currency: "USD",
      projectId: project.id,
      fundingSourceId: grant.id,
      tenantId: ngo1.id
    }
  });

  // Create AuditLog
  await prisma.auditLog.create({
    data: {
      action: "CREATE",
      entityType: "Project",
      entityId: project.id,
      userId: user.id,
      tenantId: ngo1.id
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
