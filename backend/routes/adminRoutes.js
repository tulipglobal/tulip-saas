// ─────────────────────────────────────────────────────────────
//  routes/adminRoutes.js — Superadmin dashboard API
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')

// Superadmin check middleware — accepts NGO superadmin OR admin panel JWT
async function superadminOnly(req, res, next) {
  try {
    // Admin panel JWT (role: SYSTEM_ADMIN)
    if (req.user && req.user.role === 'SYSTEM_ADMIN') {
      return next()
    }

    // Legacy NGO superadmin check (email-based)
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { email: true },
    })
    if (!user || user.email !== 'info@tulipglobal.org') {
      return res.status(403).json({ error: 'Superadmin access required' })
    }
    req.user.email = user.email
    next()
  } catch {
    return res.status(403).json({ error: 'Superadmin access required' })
  }
}

// GET /api/admin/stats — dashboard statistics
router.get('/stats', superadminOnly, async (req, res) => {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
      totalTenants,
      docsToday,
      docsMonth,
      activeSeals,
      signupsThisWeek,
      totalDocs,
      totalBundles,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.ocrJob.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.ocrJob.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.trustSeal.count({ where: { status: { not: 'revoked' } } }),
      prisma.tenant.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.ocrJob.count(),
      prisma.bundleJob.count(),
    ])

    res.json({
      totalTenants,
      docsToday,
      docsMonth,
      activeSeals,
      signupsThisWeek,
      totalDocs,
      totalBundles,
    })
  } catch (err) {
    console.error('Admin stats failed:', err)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// GET /api/admin/customers — customer list
router.get('/customers', superadminOnly, async (req, res) => {
  try {
    const { search, plan } = req.query

    const where = {}
    if (plan) where.plan = plan
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { users: { some: { email: { contains: search, mode: 'insensitive' } } } },
      ]
    }

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        users: {
          select: { email: true, name: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
        _count: { select: { ocrJobs: true, trustSeals: true, bundleJobs: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Get last activity for each tenant
    const customers = await Promise.all(tenants.map(async (t) => {
      const lastEvent = await prisma.engagementEvent.findFirst({
        where: { tenantId: t.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, eventType: true },
      })

      return {
        id: t.id,
        name: t.name,
        email: t.users[0]?.email || null,
        ownerName: t.users[0]?.name || null,
        plan: t.plan,
        planStatus: t.planStatus,
        signupDate: t.createdAt,
        docsProcessed: t._count.ocrJobs,
        sealsIssued: t._count.trustSeals,
        bundlesProcessed: t._count.bundleJobs,
        lastActive: lastEvent?.createdAt || t.createdAt,
        lastEventType: lastEvent?.eventType || null,
      }
    }))

    res.json({ data: customers, total: customers.length })
  } catch (err) {
    console.error('Admin customers failed:', err)
    res.status(500).json({ error: 'Failed to fetch customers' })
  }
})

// GET /api/admin/engagement — recent engagement events
router.get('/engagement', superadminOnly, async (req, res) => {
  try {
    const events = await prisma.engagementEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        tenant: { select: { name: true, plan: true } },
      },
    })

    res.json({
      data: events.map(e => ({
        id: e.id,
        tenantId: e.tenantId,
        tenantName: e.tenant.name,
        tenantPlan: e.tenant.plan,
        eventType: e.eventType,
        metadata: e.metadata,
        createdAt: e.createdAt,
      })),
    })
  } catch (err) {
    console.error('Admin engagement failed:', err)
    res.status(500).json({ error: 'Failed to fetch engagement' })
  }
})

// GET /api/admin/hot-leads — free tenants with 3+ docs (ready to upgrade)
router.get('/hot-leads', superadminOnly, async (req, res) => {
  try {
    const leads = await prisma.tenant.findMany({
      where: {
        plan: 'FREE',
        ocrJobs: { some: {} },
      },
      include: {
        users: {
          select: { email: true, name: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
        _count: { select: { ocrJobs: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const hotLeads = leads
      .filter(t => t._count.ocrJobs >= 3)
      .map(t => ({
        id: t.id,
        name: t.name,
        email: t.users[0]?.email || null,
        ownerName: t.users[0]?.name || null,
        docsProcessed: t._count.ocrJobs,
        signupDate: t.createdAt,
      }))
      .sort((a, b) => b.docsProcessed - a.docsProcessed)

    res.json({ data: hotLeads, total: hotLeads.length })
  } catch (err) {
    console.error('Admin hot-leads failed:', err)
    res.status(500).json({ error: 'Failed to fetch hot leads' })
  }
})

// GET /api/admin/check — check if current user is superadmin
router.get('/check', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { email: true },
    })
    res.json({ isSuperadmin: user?.email === 'info@tulipglobal.org' })
  } catch {
    res.json({ isSuperadmin: false })
  }
})

module.exports = router
