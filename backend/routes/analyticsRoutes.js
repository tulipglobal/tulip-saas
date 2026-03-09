// ─────────────────────────────────────────────────────────────
//  routes/analyticsRoutes.js — GET /api/analytics/summary
//  Returns chart data for the analytics dashboard
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')

router.get('/summary', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const rangeDays = parseInt(req.query.range) || 30
    const now = new Date()
    const rangeStart = new Date(now)
    rangeStart.setDate(rangeStart.getDate() - rangeDays)

    // ── Documents over time ──────────────────────────────────
    const docs = await prisma.document.findMany({
      where: { tenantId, uploadedAt: { gte: rangeStart } },
      select: { uploadedAt: true },
      orderBy: { uploadedAt: 'asc' },
    })

    const docsByDate = {}
    for (const d of docs) {
      const date = d.uploadedAt.toISOString().slice(0, 10)
      docsByDate[date] = (docsByDate[date] || 0) + 1
    }
    const documentsOverTime = Object.entries(docsByDate).map(([date, count]) => ({ date, count }))

    // ── Blockchain verifications ─────────────────────────────
    // Documents that have a matching confirmed AuditLog entry
    const verifiedLogs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        entityType: 'Document',
        anchorStatus: 'confirmed',
        ancheredAt: { not: null, gte: rangeStart },
      },
      select: { ancheredAt: true },
      orderBy: { ancheredAt: 'asc' },
    })

    const verByDate = {}
    for (const v of verifiedLogs) {
      const date = v.ancheredAt.toISOString().slice(0, 10)
      verByDate[date] = (verByDate[date] || 0) + 1
    }
    const blockchainVerifications = Object.entries(verByDate).map(([date, count]) => ({ date, count }))

    // ── Funding vs Spent (last 6 months) ─────────────────────
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const agreements = await prisma.fundingAgreement.findMany({
      where: { tenantId, createdAt: { gte: sixMonthsAgo } },
      select: { totalAmount: true, createdAt: true },
    })

    const expenses = await prisma.expense.findMany({
      where: { tenantId, createdAt: { gte: sixMonthsAgo } },
      select: { amount: true, createdAt: true },
    })

    const monthLabels = []
    const fundingByMonth = {}
    const spentByMonth = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-US', { month: 'short' })
      monthLabels.push({ key, label })
      fundingByMonth[key] = 0
      spentByMonth[key] = 0
    }

    for (const a of agreements) {
      const key = `${a.createdAt.getFullYear()}-${String(a.createdAt.getMonth() + 1).padStart(2, '0')}`
      if (fundingByMonth[key] !== undefined) fundingByMonth[key] += a.totalAmount
    }
    for (const e of expenses) {
      const key = `${e.createdAt.getFullYear()}-${String(e.createdAt.getMonth() + 1).padStart(2, '0')}`
      if (spentByMonth[key] !== undefined) spentByMonth[key] += e.amount
    }

    const fundingVsSpent = monthLabels.map(({ key, label }) => ({
      month: label,
      received: Math.round(fundingByMonth[key] || 0),
      spent: Math.round(spentByMonth[key] || 0),
    }))

    // ── Expenses by category ─────────────────────────────────
    const expenseCats = await prisma.expense.groupBy({
      by: ['category'],
      where: { tenantId },
      _sum: { amount: true },
    })
    const expensesByCategory = expenseCats
      .filter(e => e.category)
      .map(e => ({ category: e.category, amount: Math.round(e._sum.amount || 0) }))
      .sort((a, b) => b.amount - a.amount)

    // ── Donor engagement (best effort) ───────────────────────
    // DonorUser has no tenantId — resolve via FundingAgreement
    let donorEngagement = []
    try {
      const donorIds = await prisma.fundingAgreement.findMany({
        where: { tenantId },
        select: { donorId: true },
        distinct: ['donorId'],
      })
      const ids = donorIds.map(d => d.donorId).filter(Boolean)

      if (ids.length > 0) {
        const donorUsers = await prisma.donorUser.findMany({
          where: { donorId: { in: ids } },
          select: { createdAt: true },
        })
        // Use DonorUser createdAt as a proxy for logins (best we have)
        const engByDate = {}
        for (const du of donorUsers) {
          const date = du.createdAt.toISOString().slice(0, 10)
          engByDate[date] = (engByDate[date] || 0) + 1
        }
        donorEngagement = Object.entries(engByDate).map(([date, logins]) => ({
          date, logins, views: 0,
        }))
      }
    } catch {
      // Don't fail if DonorUser table doesn't exist
    }

    // ── Totals ───────────────────────────────────────────────
    const [totalDocs, totalVerified, totalExpenseSum] = await Promise.all([
      prisma.document.count({ where: { tenantId } }),
      prisma.auditLog.count({ where: { tenantId, entityType: 'Document', anchorStatus: 'confirmed' } }),
      prisma.expense.aggregate({ where: { tenantId }, _sum: { amount: true } }),
    ])

    const allAgreements = await prisma.fundingAgreement.aggregate({
      where: { tenantId },
      _sum: { totalAmount: true },
    })

    res.json({
      documentsOverTime,
      blockchainVerifications,
      fundingVsSpent,
      expensesByCategory,
      donorEngagement,
      totals: {
        totalDocuments: totalDocs,
        totalVerified,
        totalFundingReceived: Math.round(allAgreements._sum.totalAmount || 0),
        totalFundingSpent: Math.round(totalExpenseSum._sum.amount || 0),
        totalExpenses: Math.round(totalExpenseSum._sum.amount || 0),
        totalDonorLogins: donorEngagement.reduce((s, d) => s + d.logins, 0),
      },
    })
  } catch (err) {
    console.error('[analytics/summary]', err)
    res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})

module.exports = router
