// ─────────────────────────────────────────────────────────────
//  lib/prismaRls.js — v1
//
//  Wraps Prisma with RLS context injection.
//  Before every query, sets app.current_tenant_id in the
//  PostgreSQL session so RLS policies can enforce isolation.
//
//  Usage:
//    Replace: const prisma = require('../lib/client')
//    With:    const { getPrismaForTenant } = require('../lib/prismaRls')
//
//  In routes/controllers:
//    const db = getPrismaForTenant(req.tenantId)
//    const projects = await db.project.findMany()  // RLS enforced
//
//  The standard prisma client (lib/client.js) still works for:
//    - Migrations
//    - Seeds
//    - Auth (login needs to query across tenants)
//    - Internal services (anchorScheduler, etc.)
// ─────────────────────────────────────────────────────────────

const { PrismaClient } = require('@prisma/client')

// Pool of tenant-scoped clients (reuse per tenantId)
const clientPool = new Map()

function getPrismaForTenant(tenantId) {
  if (!tenantId) throw new Error('tenantId is required for RLS-scoped queries')

  if (clientPool.has(tenantId)) return clientPool.get(tenantId)

  const client = new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_URL }
    }
  })

  // Extend client to set RLS context before every query
  const extended = client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          // Set tenant context for this transaction
          const [, result] = await client.$transaction([
            client.$executeRawUnsafe(
              `SET LOCAL app.current_tenant_id = '${tenantId.replace(/'/g, "''")}'`
            ),
            query(args),
          ])
          return result
        }
      }
    }
  })

  clientPool.set(tenantId, extended)
  return extended
}

// ── Single-query helper ───────────────────────────────────────
// For one-off RLS queries without caching the client
async function withTenant(tenantId, callback) {
  const db = getPrismaForTenant(tenantId)
  return callback(db)
}

// ── Cleanup on shutdown ───────────────────────────────────────
async function disconnectAll() {
  for (const client of clientPool.values()) {
    await client.$disconnect()
  }
  clientPool.clear()
}

module.exports = { getPrismaForTenant, withTenant, disconnectAll }
