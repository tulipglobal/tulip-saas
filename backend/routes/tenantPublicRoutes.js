// ─────────────────────────────────────────────────────────────
//  routes/tenantPublicRoutes.js — v1
//
//  Public (no auth) endpoints for the donor portal.
//
//  GET /api/tenants/public          — list all active tenants with stats
//  GET /api/tenants/public/:slug    — single tenant profile with projects + expenses
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router  = express.Router()
const prisma  = require('../lib/client')

// GET /api/tenants/public — list all active tenants for donor portal
router.get('/', async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, slug: true, tenantType: true, createdAt: true,
      }
    })

    // Enrich with stats
    const items = await Promise.all(tenants.map(async (t) => {
      const [totalProjects, totalExpenses, totalAnchored] = await Promise.all([
        prisma.project.count({ where: { tenantId: t.id } }),
        prisma.expense.count({ where: { tenantId: t.id } }),
        prisma.auditLog.count({ where: { tenantId: t.id, anchorStatus: 'confirmed' } }),
      ])

      const totalAudit = await prisma.auditLog.count({ where: { tenantId: t.id } })
      const failed = await prisma.auditLog.count({ where: { tenantId: t.id, anchorStatus: 'failed' } })
      const integrityScore = totalAudit > 0
        ? Math.round(((totalAudit - failed) / totalAudit) * 100)
        : 100

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: null,
        country: null,
        website: null,
        verifiedAt: t.createdAt,
        integrityScore,
        totalProjects,
        totalExpenses,
        totalAnchored,
      }
    }))

    res.json({ items })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tenants/public/:slug — single tenant profile for donor view
router.get('/:slug', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: req.params.slug },
          { id: req.params.slug },
        ],
        status: 'active',
      },
    })

    if (!tenant) return res.status(404).json({ error: 'Organisation not found' })

    const tenantId = tenant.id

    const [projects, totalExpenses, totalAnchored, totalAudit, failed] = await Promise.all([
      prisma.project.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, status: true, budget: true, createdAt: true,
          _count: { select: { expenses: true } },
        },
      }),
      prisma.expense.count({ where: { tenantId } }),
      prisma.auditLog.count({ where: { tenantId, anchorStatus: 'confirmed' } }),
      prisma.auditLog.count({ where: { tenantId } }),
      prisma.auditLog.count({ where: { tenantId, anchorStatus: 'failed' } }),
    ])

    const recentExpenses = await prisma.expense.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, description: true, amount: true, currency: true, createdAt: true,
        projectId: true,
        project: { select: { name: true } },
      },
    })

    // Get anchor info for recent expenses from audit logs
    const expenseIds = recentExpenses.map(e => e.id)
    const auditLogs = await prisma.auditLog.findMany({
      where: { tenantId, entityType: 'Expense', entityId: { in: expenseIds } },
      select: { entityId: true, anchorStatus: true, dataHash: true, blockchainTx: true },
    })
    const auditMap = Object.fromEntries(auditLogs.map(a => [a.entityId, a]))

    const integrityScore = totalAudit > 0
      ? Math.round(((totalAudit - failed) / totalAudit) * 100)
      : 100

    res.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      description: null,
      country: null,
      website: null,
      verifiedAt: tenant.createdAt,
      integrityScore,
      totalExpenses,
      totalAnchored,
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        budget: p.budget,
        currency: 'USD',
        startDate: null,
        endDate: null,
        _count: p._count,
      })),
      recentExpenses: recentExpenses.map(e => {
        const audit = auditMap[e.id]
        return {
          id: e.id,
          title: e.description,
          amount: e.amount,
          currency: e.currency,
          category: null,
          vendor: null,
          expenseDate: e.createdAt,
          anchorStatus: audit?.anchorStatus ?? 'pending',
          dataHash: audit?.dataHash ?? null,
          blockchainTx: audit?.blockchainTx ?? null,
          project: e.project ? { name: e.project.name } : null,
        }
      }),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
