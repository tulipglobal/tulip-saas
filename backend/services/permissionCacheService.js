// ─────────────────────────────────────────────────────────────
//  services/permissionCacheService.js — v1
//
//  Builds and invalidates the UserPermissionCache table.
//  Called whenever roles or permissions change.
//
//  Usage:
//    const { buildCache, invalidateCache } = require('./permissionCacheService')
//
//    await buildCache(userId, tenantId)      // rebuild one user's cache
//    await invalidateForRole(roleId)         // rebuild all users with this role
//    await invalidateForTenant(tenantId)     // rebuild all users in tenant
// ─────────────────────────────────────────────────────────────

const prisma = require('../lib/client')

// ── Build cache for a single user ────────────────────────────
async function buildCache(userId, tenantId) {
  // Load all roles for this user+tenant, expand to permissions
  const userRoles = await prisma.userRole.findMany({
    where: { userId, tenantId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true }
          }
        }
      }
    }
  })

  // Flatten to unique permission keys
  const permissionSet = new Set()
  for (const ur of userRoles) {
    for (const rp of ur.role.permissions) {
      permissionSet.add(rp.permission.key)
    }
  }

  const permissions = Array.from(permissionSet)

  // Upsert into cache table
  await prisma.userPermissionCache.upsert({
    where:  { userId_tenantId: { userId, tenantId } },
    update: { permissions, updatedAt: new Date() },
    create: { userId, tenantId, permissions }
  })

  return permissions
}

// ── Invalidate cache for all users that have a specific role ──
async function invalidateForRole(roleId) {
  const userRoles = await prisma.userRole.findMany({
    where:  { roleId },
    select: { userId: true, tenantId: true }
  })

  await Promise.all(
    userRoles.map(({ userId, tenantId }) => buildCache(userId, tenantId))
  )

  console.log(`[permCache] Rebuilt cache for ${userRoles.length} user(s) on role ${roleId}`)
}

// ── Invalidate cache for all users in a tenant ────────────────
async function invalidateForTenant(tenantId) {
  const userRoles = await prisma.userRole.findMany({
    where:  { tenantId },
    select: { userId: true, tenantId: true },
    distinct: ['userId']
  })

  await Promise.all(
    userRoles.map(({ userId }) => buildCache(userId, tenantId))
  )

  console.log(`[permCache] Rebuilt cache for ${userRoles.length} user(s) in tenant ${tenantId}`)
}

// ── Delete cache for a single user (forces DB fallback) ───────
async function clearCache(userId, tenantId) {
  await prisma.userPermissionCache.deleteMany({
    where: { userId, tenantId }
  })
}

module.exports = { buildCache, invalidateForRole, invalidateForTenant, clearCache }
