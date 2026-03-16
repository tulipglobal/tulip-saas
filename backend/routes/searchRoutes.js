const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')

router.use(authenticate, tenantScope)

// GET /api/search?q=term&type=all
router.get('/', async (req, res) => {
  try {
    const { q, type = 'all' } = req.query
    const tenantId = req.user.tenantId
    if (!q || q.length < 2) return res.json({ results: [] })

    const term = `%${q}%`
    const results = []

    if (type === 'all' || type === 'projects') {
      const projects = await prisma.$queryRawUnsafe(
        `SELECT id, name, status, 'project' as type FROM "Project" WHERE "tenantId" = $1 AND (name ILIKE $2 OR description ILIKE $2) LIMIT 5`,
        tenantId, term
      )
      results.push(...projects.map(p => ({ ...p, type: 'project', url: `/dashboard/projects/${p.id}` })))
    }

    if (type === 'all' || type === 'expenses') {
      const expenses = await prisma.$queryRawUnsafe(
        `SELECT e.id, COALESCE(e.vendor, e.description) as name, e."approvalStatus" as status, 'expense' as type FROM "Expense" e WHERE e."tenantId" = $1 AND (e.vendor ILIKE $2 OR e.description ILIKE $2 OR CAST(e.amount AS TEXT) LIKE $2) LIMIT 5`,
        tenantId, term
      )
      results.push(...expenses.map(e => ({ ...e, type: 'expense', url: `/dashboard/expenses` })))
    }

    if (type === 'all' || type === 'documents') {
      const documents = await prisma.$queryRawUnsafe(
        `SELECT id, name, "approvalStatus" as status, 'document' as type FROM "Document" WHERE "tenantId" = $1 AND (name ILIKE $2 OR description ILIKE $2) LIMIT 5`,
        tenantId, term
      )
      results.push(...documents.map(d => ({ ...d, type: 'document', url: `/dashboard/documents` })))
    }

    if (type === 'all' || type === 'donors') {
      const donors = await prisma.$queryRawUnsafe(
        `SELECT do2.id, do2.name, 'donor' as type FROM "DonorOrganisation" do2
         WHERE do2.id IN (SELECT DISTINCT "donorOrgId" FROM "DonorProjectAccess" WHERE "projectId" IN (SELECT id FROM "Project" WHERE "tenantId" = $1) AND "revokedAt" IS NULL)
         AND do2.name ILIKE $2 LIMIT 5`,
        tenantId, term
      )
      results.push(...donors.map(d => ({ ...d, type: 'donor', url: `/dashboard/settings/donors` })))
    }

    res.json({ results })
  } catch (err) {
    console.error('Search error:', err)
    res.status(500).json({ error: 'Search failed' })
  }
})

module.exports = router
