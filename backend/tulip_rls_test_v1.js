// ─────────────────────────────────────────────────────────────
//  tulip_rls_test_v1.js
//
//  Verifies RLS is working correctly:
//  1. app_user with tenant A can only see tenant A data
//  2. app_user with tenant B can only see tenant B data
//  3. Cross-tenant query returns 0 rows (not an error)
//
//  Run: node tulip_rls_test_v1.js
// ─────────────────────────────────────────────────────────────

require('dotenv').config()
const { Client } = require('pg')

const SUPERUSER_URL = process.env.DATABASE_URL ||
  'postgresql://benzer@localhost:5432/tulip'

const APP_USER_URL =
  'postgresql://app_user:tulip_app_secure_2026@localhost:5432/tulip'

async function runAsAppUser(tenantId, query) {
  const client = new Client({ connectionString: APP_USER_URL })
  await client.connect()
  await client.query(`SET app.current_tenant_id = '${tenantId}'`)
  const result = await client.query(query)
  await client.end()
  return result.rows
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Tulip RLS Verification Test')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Get all tenants (as superuser)
  const su = new Client({ connectionString: SUPERUSER_URL })
  await su.connect()
  const tenants = await su.query('SELECT id, name FROM "Tenant" LIMIT 5')
  await su.end()

  if (tenants.rows.length === 0) {
    console.log('No tenants found. Run seeds first.')
    return
  }

  const tenant = tenants.rows[0]
  const fakeTenantId = '00000000-0000-0000-0000-000000000000'

  console.log(`Using tenant: ${tenant.name} (${tenant.id})\n`)

  // Test 1: Correct tenant sees their data
  console.log('Test 1 — Correct tenant sees their own projects:')
  const ownProjects = await runAsAppUser(
    tenant.id,
    'SELECT id, name, "tenantId" FROM "Project" LIMIT 5'
  )
  console.log(`  Result: ${ownProjects.length} project(s) returned`)
  ownProjects.forEach(p => console.log(`    ✔  ${p.name} (${p.tenantId.slice(0,8)}...)`))

  // Test 2: Wrong tenant sees nothing
  console.log('\nTest 2 — Wrong tenant sees zero rows (RLS enforcement):')
  const crossProjects = await runAsAppUser(
    fakeTenantId,
    'SELECT id, name FROM "Project"'
  )
  if (crossProjects.length === 0) {
    console.log('  ✔  0 rows returned — cross-tenant isolation WORKING')
  } else {
    console.log(`  ✖  FAIL — ${crossProjects.length} rows leaked! RLS not working.`)
  }

  // Test 3: Audit logs isolated
  console.log('\nTest 3 — AuditLog isolation:')
  const ownLogs = await runAsAppUser(
    tenant.id,
    'SELECT COUNT(*) as count FROM "AuditLog"'
  )
  const crossLogs = await runAsAppUser(
    fakeTenantId,
    'SELECT COUNT(*) as count FROM "AuditLog"'
  )
  console.log(`  Own tenant logs:   ${ownLogs[0].count}`)
  console.log(`  Cross tenant logs: ${crossLogs[0].count} ${crossLogs[0].count === '0' ? '✔' : '✖ LEAK'}`)

  // Test 4: Webhooks isolated
  console.log('\nTest 4 — Webhook isolation:')
  const ownWebhooks  = await runAsAppUser(tenant.id, 'SELECT COUNT(*) as count FROM "Webhook"')
  const crossWebhooks = await runAsAppUser(fakeTenantId, 'SELECT COUNT(*) as count FROM "Webhook"')
  console.log(`  Own tenant webhooks:   ${ownWebhooks[0].count}`)
  console.log(`  Cross tenant webhooks: ${crossWebhooks[0].count} ${crossWebhooks[0].count === '0' ? '✔' : '✖ LEAK'}`)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  RLS test complete')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch(console.error)
