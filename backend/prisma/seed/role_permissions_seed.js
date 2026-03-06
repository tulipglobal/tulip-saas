require('dotenv').config()

const prisma = require("../../lib/client");

async function main() {

  const adminRole = await prisma.role.findFirst({
    where: { name: "admin" }
  });

  const permissions = await prisma.permission.findMany();

  const permKeys = [
    "system:admin",
    "tenant:admin",
    "batch:submit",
    "proofs:read",
    "proofs:verify"
  ];

  for (const key of permKeys) {

    const permission = permissions.find(p => p.key === key);

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id
        }
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id
      }
    });

  }

  console.log("✅ Role permissions mapped successfully");

}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
