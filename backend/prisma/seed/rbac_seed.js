require('dotenv').config()

const prisma = require("../../lib/client")

async function main() {

  // ── All permissions ───────────────────────────────────────
  const permissions = [
    // Existing
    { key: "proofs:read",      description: "Read audit proofs" },
    { key: "proofs:verify",    description: "Verify blockchain proof" },
    { key: "batch:submit",     description: "Submit blockchain batch" },
    { key: "keys:manage",      description: "Manage API keys" },
    { key: "tenant:admin",     description: "Tenant administration" },
    { key: "system:admin",     description: "System administration" },

    // Projects
    { key: "projects:read",    description: "View projects" },
    { key: "projects:write",   description: "Create and update projects" },
    { key: "projects:delete",  description: "Delete projects" },

    // Funding sources
    { key: "funding:read",     description: "View funding sources" },
    { key: "funding:write",    description: "Create and update funding sources" },
    { key: "funding:delete",   description: "Delete funding sources" },

    // Expenses
    { key: "expenses:read",    description: "View expenses" },
    { key: "expenses:write",   description: "Create and update expenses" },
    { key: "expenses:delete",  description: "Delete expenses" },

    // Documents
    { key: "documents:read",   description: "View documents" },
    { key: "documents:write",  description: "Upload documents" },
    { key: "documents:delete", description: "Delete documents" },

    // Audit
    { key: "audit:read",       description: "View audit logs" },
    { key: "audit:write",      description: "Create audit log entries" },

    // Users & roles
    { key: "users:read",       description: "View users" },
    { key: "users:write",      description: "Create and update users" },
    { key: "roles:read",       description: "View roles and permissions" },
    { key: "roles:write",      description: "Assign roles to users" },
  ]

  for (const p of permissions) {
    await prisma.permission.upsert({
      where:  { key: p.key },
      update: { description: p.description },
      create: p
    })
  }
  console.log(`✔ ${permissions.length} permissions seeded`)

  // ── Fetch tenant ──────────────────────────────────────────
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'caritas-kenya' }
  })
  if (!tenant) throw new Error('Tenant caritas-kenya not found — run seed.js first')

  // ── Upsert roles ──────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where:  { tenantId_name: { tenantId: tenant.id, name: 'admin' } },
    update: {},
    create: { name: 'admin', tenantId: tenant.id }
  })

  const auditorRole = await prisma.role.upsert({
    where:  { tenantId_name: { tenantId: tenant.id, name: 'auditor' } },
    update: {},
    create: { name: 'auditor', tenantId: tenant.id }
  })

  const viewerRole = await prisma.role.upsert({
    where:  { tenantId_name: { tenantId: tenant.id, name: 'viewer' } },
    update: {},
    create: { name: 'viewer', tenantId: tenant.id }
  })

  console.log('✔ Roles seeded: admin, auditor, viewer')

  // ── Assign permissions to roles ───────────────────────────
  const adminPermissions = [
    'proofs:read', 'proofs:verify', 'batch:submit', 'keys:manage',
    'tenant:admin', 'projects:read', 'projects:write', 'projects:delete',
    'funding:read', 'funding:write', 'funding:delete',
    'expenses:read', 'expenses:write', 'expenses:delete',
    'documents:read', 'documents:write', 'documents:delete',
    'audit:read', 'audit:write',
    'users:read', 'users:write', 'roles:read', 'roles:write',
  ]

  const auditorPermissions = [
    'proofs:read', 'proofs:verify', 'batch:submit',
    'projects:read', 'funding:read', 'expenses:read',
    'documents:read', 'audit:read', 'audit:write',
  ]

  const viewerPermissions = [
    'proofs:read', 'projects:read', 'funding:read',
    'expenses:read', 'documents:read', 'audit:read',
  ]

  async function assignPermissions(role, permKeys) {
    for (const key of permKeys) {
      const perm = await prisma.permission.findUnique({ where: { key } })
      if (!perm) { console.warn(`  ⚠ Permission not found: ${key}`); continue }
      await prisma.rolePermission.upsert({
        where:  { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id }
      })
    }
    console.log(`✔ ${permKeys.length} permissions assigned to ${role.name}`)
  }

  await assignPermissions(adminRole,   adminPermissions)
  await assignPermissions(auditorRole, auditorPermissions)
  await assignPermissions(viewerRole,  viewerPermissions)

  // ── Assign admin user to admin role ───────────────────────
  const user = await prisma.user.findUnique({
    where: { email: 'admin@caritas-kenya.org' }
  })
  if (user) {
    await prisma.userRole.upsert({
      where:  { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      update: {},
      create: { userId: user.id, roleId: adminRole.id, tenantId: tenant.id }
    })
    console.log('✔ admin@caritas-kenya.org assigned admin role')
  }

  console.log('\n✅ RBAC seed complete')
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
