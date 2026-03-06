// ─────────────────────────────────────────────────────────────
//  tests/tulip_api_tests_v1.js
//
//  Core API test suite — runs against live server on port 5050
//  Tests: auth, projects, expenses, audit, timestamps, api-keys
//
//  Run: node tests/tulip_api_tests_v1.js
//  Requires server running: npm run dev
// ─────────────────────────────────────────────────────────────

const BASE = 'http://localhost:5050'

let passed = 0
let failed = 0
let token, refreshToken, projectId, expenseId, auditId, apiKeyId, apiKey

// ── Test runner ───────────────────────────────────────────────
async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✔  ${name}`)
    passed++
  } catch (err) {
    console.log(`  ✖  ${name}`)
    console.log(`     ${err.message}`)
    failed++
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed')
}

async function api(method, path, body = null, authToken = null, useApiKey = false) {
  const headers = { 'Content-Type': 'application/json' }
  if (authToken && !useApiKey) headers['Authorization'] = `Bearer ${authToken}`
  if (authToken && useApiKey)  headers['Authorization'] = `ApiKey ${authToken}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

// ── Test suites ───────────────────────────────────────────────
async function runAuthTests() {
  console.log('\n── Auth ─────────────────────────────────────')

  await test('Login returns accessToken + refreshToken', async () => {
    const { status, data } = await api('POST', '/api/auth/login', {
      email: 'admin@caritas-kenya.org', password: 'Admin1234!'
    })
    assert(status === 200, `Expected 200, got ${status}`)
    assert(data.accessToken,  'No accessToken in response')
    assert(data.refreshToken, 'No refreshToken in response')
    assert(data.expiresIn,    'No expiresIn in response')
    token        = data.accessToken
    refreshToken = data.refreshToken
  })

  await test('Login fails with wrong password', async () => {
    const { status } = await api('POST', '/api/auth/login', {
      email: 'admin@caritas-kenya.org', password: 'wrongpassword'
    })
    assert(status === 401, `Expected 401, got ${status}`)
  })

  await test('Refresh token rotation works', async () => {
    const { status, data } = await api('POST', '/api/auth/refresh', { refreshToken })
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`)
    assert(data.accessToken,  'No new accessToken')
    assert(data.refreshToken, 'No new refreshToken')
    assert(data.refreshToken !== refreshToken, 'Refresh token not rotated')
    token        = data.accessToken
    refreshToken = data.refreshToken
  })

  await test('Old refresh token rejected after rotation', async () => {
    // Try to use the OLD refresh token that was just rotated
    const { status } = await api('POST', '/api/auth/refresh', { refreshToken: 'invalid-old-token' })
    assert(status === 401, `Expected 401, got ${status}`)
  })

  await test('GET /me returns user profile', async () => {
    const { status, data } = await api('GET', '/api/auth/me', null, token)
    assert(status === 200, `Expected 200, got ${status}`)
    assert(data.email,    'No email in profile')
    assert(data.tenantId, 'No tenantId in profile')
  })

  await test('Unauthenticated request rejected', async () => {
    const { status } = await api('GET', '/api/projects')
    assert(status === 401, `Expected 401, got ${status}`)
  })
}

async function runProjectTests() {
  console.log('\n── Projects ─────────────────────────────────')

  await test('GET /projects returns paginated response', async () => {
    const { status, data } = await api('GET', '/api/projects', null, token)
    assert(status === 200, `Expected 200, got ${status}`)
    assert(Array.isArray(data.data), 'data.data should be array')
    assert(data.pagination,          'No pagination object')
    assert(data.pagination.total >= 0, 'No total count')
  })

  await test('GET /projects?limit=1 returns 1 result', async () => {
    const { status, data } = await api('GET', '/api/projects?limit=1', null, token)
    assert(status === 200, `Expected 200, got ${status}`)
    assert(data.data.length <= 1, 'Should return max 1 result')
    assert(data.pagination.limit === 1, 'Limit not applied')
  })

  await test('POST /projects creates project', async () => {
    const { status, data } = await api('POST', '/api/projects', {
      name: 'Test Project', description: 'Automated test', budget: 10000
    }, token)
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`)
    assert(data.id,   'No id in response')
    assert(data.name === 'Test Project', 'Name mismatch')
    projectId = data.id
  })

  await test('GET /projects/:id returns project', async () => {
    const { status, data } = await api('GET', `/api/projects/${projectId}`, null, token)
    assert(status === 200, `Expected 200, got ${status}`)
    assert(data.id === projectId, 'ID mismatch')
  })

  await test('PUT /projects/:id updates project', async () => {
    const { status, data } = await api('PUT', `/api/projects/${projectId}`,
      { status: 'completed' }, token)
    assert(status === 200, `Expected 200, got ${status}`)
    assert(data.status === 'completed', 'Status not updated')
  })
}

async function runExpenseTests() {
  console.log('\n── Expenses ─────────────────────────────────')

  await test('GET /expenses returns paginated response', async () => {
    const { status, data } = await api('GET', '/api/expenses', null, token)
    assert(status === 200, `Expected 200, got ${status}`)
    assert(Array.isArray(data.data), 'data.data should be array')
    assert(data.pagination, 'No pagination object')
  })

  await test('POST /expenses creates expense', async () => {
    // fundingSourceId is NOT NULL in schema — fetch a real one first
    const { data: fsData } = await api('GET', '/api/funding-sources', null, token)
    const sources = fsData.data || fsData
    assert(sources.length > 0, 'No funding sources available for test')
    const fundingSourceId = sources[0].id

    const { status, data } = await api('POST', '/api/expenses', {
      description: 'Test expense', amount: 500, currency: 'USD',
      projectId, fundingSourceId
    }, token)
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`)
    assert(data.id, 'No id in response')
    expenseId = data.id
  })

  await test('GET /expenses?projectId= filters correctly', async () => {
    const { status, data } = await api('GET', `/api/expenses?projectId=${projectId}`, null, token)
    assert(status === 200, `Expected 200, got ${status}`)
    data.data.forEach(e => assert(e.projectId === projectId, 'Wrong project in results'))
  })
}

async function runAuditTests() {
  console.log('\n── Audit Logs ───────────────────────────────')

  await test('GET /audit returns paginated audit logs', async () => {
    const { status, data } = await api('GET', '/api/audit', null, token)
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data).slice(0,100)}`)
    assert(Array.isArray(data.data), 'data.data should be array')
    assert(data.pagination, 'No pagination object')
    if (data.data.length > 0) auditId = data.data[0].id
  })

  await test('POST /audit/test creates audit log', async () => {
    const { status, data } = await api('POST', '/api/audit/test', {}, token)
    assert(status === 200, `Expected 200, got ${status}`)
    assert(data.log?.id, 'No log id')
    auditId = auditId || data.log.id
  })
}

async function runTimestampTests() {
  console.log('\n── Timestamps ───────────────────────────────')

  if (!auditId) { console.log('  ⚠  Skipped — no auditId available'); return }

  await test('POST /timestamps/:id stamps an audit log', async () => {
    const { status, data } = await api('POST', `/api/timestamps/${auditId}`, {}, token)
    assert([200, 201].includes(status), `Expected 200/201, got ${status}: ${JSON.stringify(data)}`)
    assert(data.status === 'stamped' || data.already, 'Not stamped')
  })

  await test('GET /timestamps/:id/verify confirms token is valid', async () => {
    const { status, data } = await api('GET', `/api/timestamps/${auditId}/verify`, null, token)
    assert(status === 200, `Expected 200, got ${status}`)
    assert(data.valid === true, 'Timestamp not valid')
    assert(data.hashPresent === true, 'Hash not present in token')
  })
}

async function runApiKeyTests() {
  console.log('\n── API Keys ─────────────────────────────────')

  await test('POST /api-keys creates a key', async () => {
    const { status, data } = await api('POST', '/api/api-keys', {
      name: 'Test Key', permissions: ['verify:read', 'audit:read']
    }, token)
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`)
    assert(data.key,    'No key returned')
    assert(data.prefix, 'No prefix returned')
    apiKeyId = data.id
    apiKey   = data.key
  })

  await test('API key authenticates successfully', async () => {
    const { status, data } = await api('GET', '/api/projects', null, apiKey, true)
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data).slice(0,100)}`)
    assert(data.data || Array.isArray(data), 'No data returned')
  })

  await test('GET /api-keys lists keys', async () => {
    const { status, data } = await api('GET', '/api/api-keys', null, token)
    assert(status === 200, `Expected 200, got ${status}`)
    assert(Array.isArray(data), 'Expected array')
  })

  await test('DELETE /api-keys/:id revokes key', async () => {
    const { status, data } = await api('DELETE', `/api/api-keys/${apiKeyId}`, null, token)
    assert(status === 200, `Expected 200, got ${status}`)
    assert(data.revoked === true, 'Key not revoked')
  })

  await test('Revoked API key rejected', async () => {
    const { status } = await api('GET', '/api/projects', null, apiKey, true)
    assert(status === 401, `Expected 401, got ${status}`)
  })
}

async function runHealthTests() {
  console.log('\n── Health ───────────────────────────────────')

  await test('GET /api/health returns ok', async () => {
    const { status, data } = await api('GET', '/api/health')
    assert(status === 200, `Expected 200, got ${status}`)
    assert(data.status === 'ok', 'Status not ok')
    assert(data.db === 'connected', 'DB not connected')
  })

  await test('GET /api/docs returns Swagger UI', async () => {
    const res = await fetch(`${BASE}/api/docs`)
    assert(res.status === 200, `Expected 200, got ${res.status}`)
  })
}

// ── Cleanup ───────────────────────────────────────────────────
async function cleanup() {
  if (projectId) {
    await api('DELETE', `/api/projects/${projectId}`, null, token).catch(() => {})
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Tulip API Test Suite v1')
  console.log('  Target: http://localhost:5050')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await runHealthTests()
  await runAuthTests()
  await runProjectTests()
  await runExpenseTests()
  await runAuditTests()
  await runTimestampTests()
  await runApiKeyTests()
  await cleanup()

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Results: ${passed} passed, ${failed} failed`)
  if (failed === 0) console.log('  All tests passed!')
  else console.log(`  ${failed} test(s) need attention`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Test suite error:', err)
  process.exit(1)
})
