// ─────────────────────────────────────────────────────────────
//  routes/overviewRoutes.js — GET /api/overview
//  Returns aggregated dashboard data for the NGO overview page
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')

router.get('/', async (req, res) => {
  const { tenantId, userId } = req.user

  // ── User info ──────────────────────────────────────────────
  let user = { name: 'User', role: 'member' }
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, roles: { include: { role: { select: { name: true } } } } },
    })
    if (u) {
      const topRole = u.roles.find(r => r.role.name === 'admin') ? 'admin' : u.roles[0]?.role?.name || 'member'
      user = { name: u.name, role: topRole }
    }
  } catch (err) {
    console.error('[overview] user fetch failed:', err.message)
  }

  // ── Stats ──────────────────────────────────────────────────
  let stats = {
    totalVerified: 0,
    totalFunding: 0,
    totalFundingCurrency: 'USD',
    activeProjects: 0,
    completedProjects: 0,
    totalBlockchainTx: 0,
    documentsThisMonth: 0,
    fundingAgreementsCount: 0,
  }
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      totalVerified,
      totalBlockchainTx,
      activeProjects,
      completedProjects,
      documentsThisMonth,
      fundingAgg,
      fundingAgreementsCount,
    ] = await Promise.all([
      prisma.document.count({ where: { tenantId, approvalStatus: 'approved' } }),
      prisma.auditLog.count({ where: { tenantId, anchorStatus: 'confirmed' } }),
      prisma.project.count({ where: { tenantId, status: 'active' } }),
      prisma.project.count({ where: { tenantId, status: 'completed' } }),
      prisma.document.count({ where: { tenantId, uploadedAt: { gte: monthStart } } }),
      prisma.fundingAgreement.aggregate({ where: { tenantId }, _sum: { totalAmount: true } }),
      prisma.fundingAgreement.count({ where: { tenantId } }),
    ])

    // Try to get dominant currency from first agreement
    let currency = 'USD'
    try {
      const firstAgreement = await prisma.fundingAgreement.findFirst({
        where: { tenantId },
        select: { currency: true },
        orderBy: { totalAmount: 'desc' },
      })
      if (firstAgreement?.currency) currency = firstAgreement.currency
    } catch {}

    stats = {
      totalVerified,
      totalFunding: Math.round(fundingAgg._sum.totalAmount || 0),
      totalFundingCurrency: currency,
      activeProjects,
      completedProjects,
      totalBlockchainTx,
      documentsThisMonth,
      fundingAgreementsCount,
    }
  } catch (err) {
    console.error('[overview] stats failed:', err.message)
  }

  // ── Projects with budget info ──────────────────────────────
  let projects = []
  try {
    const rawProjects = await prisma.project.findMany({
      where: { tenantId, status: { in: ['active', 'on_hold'] } },
      select: { id: true, name: true, status: true, budget: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 9,
    })

    // Get expenses per project
    const projectIds = rawProjects.map(p => p.id)
    const expensesByProject = projectIds.length > 0
      ? await prisma.expense.groupBy({
          by: ['projectId'],
          where: { tenantId, projectId: { in: projectIds } },
          _sum: { amount: true },
        })
      : []

    const expenseMap = {}
    for (const e of expensesByProject) {
      expenseMap[e.projectId] = Math.round(e._sum.amount || 0)
    }

    // Get funding per project
    const fundingByProject = projectIds.length > 0
      ? await prisma.projectFunding.groupBy({
          by: ['projectId'],
          where: { projectId: { in: projectIds } },
          _sum: { allocatedAmount: true },
        })
      : []

    const fundingMap = {}
    for (const f of fundingByProject) {
      fundingMap[f.projectId] = Math.round(f._sum.allocatedAmount || 0)
    }

    projects = rawProjects.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      budget: p.budget || 0,
      totalFunding: fundingMap[p.id] || p.budget || 0,
      totalExpenses: expenseMap[p.id] || 0,
      startDate: p.createdAt,
      endDate: null, // projects don't have an end date field yet
    }))
  } catch (err) {
    console.error('[overview] projects failed:', err.message)
  }

  // ── Activity feed ──────────────────────────────────────────
  let activityFeed = []
  try {
    const logs = await prisma.auditLog.findMany({
      where: { tenantId },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        userId: true,
        anchorStatus: true,
        blockchainTx: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Resolve user names
    const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))]
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : []
    const userMap = {}
    for (const u of users) userMap[u.id] = u.name

    activityFeed = logs.map(l => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      createdAt: l.createdAt,
      userName: l.userId ? (userMap[l.userId] || 'Unknown') : 'System',
      anchorStatus: l.anchorStatus,
      blockchainTx: l.blockchainTx,
    }))
  } catch (err) {
    console.error('[overview] activityFeed failed:', err.message)
  }

  // ── Chart data (last 6 months) ─────────────────────────────
  let chartData = []
  try {
    const now = new Date()
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const [docs, agreements] = await Promise.all([
      prisma.document.findMany({
        where: { tenantId, uploadedAt: { gte: sixMonthsAgo } },
        select: { uploadedAt: true },
      }),
      prisma.fundingAgreement.findMany({
        where: { tenantId, createdAt: { gte: sixMonthsAgo } },
        select: { totalAmount: true, createdAt: true },
      }),
    ])

    const months = []
    const docsByMonth = {}
    const fundingByMonth = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-US', { month: 'short' })
      months.push({ key, label })
      docsByMonth[key] = 0
      fundingByMonth[key] = 0
    }

    for (const doc of docs) {
      const key = `${doc.uploadedAt.getFullYear()}-${String(doc.uploadedAt.getMonth() + 1).padStart(2, '0')}`
      if (docsByMonth[key] !== undefined) docsByMonth[key]++
    }
    for (const a of agreements) {
      const key = `${a.createdAt.getFullYear()}-${String(a.createdAt.getMonth() + 1).padStart(2, '0')}`
      if (fundingByMonth[key] !== undefined) fundingByMonth[key] += a.totalAmount
    }

    chartData = months.map(({ key, label }) => ({
      month: label,
      documents: docsByMonth[key] || 0,
      funding: Math.round(fundingByMonth[key] || 0),
    }))
  } catch (err) {
    console.error('[overview] chartData failed:', err.message)
  }

  res.json({ user, stats, projects, activityFeed, chartData })
})

module.exports = router
