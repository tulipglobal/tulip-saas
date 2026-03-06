// ─────────────────────────────────────────────────────────────
//  tulip_warm_permission_cache_v1.js
//  Run ONCE after deploying the UserPermissionCache table.
//  Builds cache entries for all existing users.
//
//  Run from backend/:
//    node tulip_warm_permission_cache_v1.js
// ─────────────────────────────────────────────────────────────

require('dotenv').config()
const prisma = require('./lib/client')
const { buildCache } = require('./services/permissionCacheService')

async function main() {
  console.log('Warming permission cache for all existing users...\n')

  const userRoles = await prisma.userRole.findMany({
    select: { userId: true, tenantId: true },
    distinct: ['userId', 'tenantId']
  })

  if (userRoles.length === 0) {
    console.log('No users found — nothing to warm.')
    return
  }

  let success = 0, failed = 0

  for (const { userId, tenantId } of userRoles) {
    try {
      const perms = await buildCache(userId, tenantId)
      console.log(`  ✔ ${userId.slice(0, 8)}... → ${perms.length} permissions`)
      success++
    } catch (err) {
      console.log(`  ✖ ${userId.slice(0, 8)}... → Error: ${err.message}`)
      failed++
    }
  }

  console.log(`\n✅ Cache warm complete: ${success} users cached, ${failed} failed`)
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
