// ─────────────────────────────────────────────────────────────
//  routes/analyticsRoutes.js — GET /api/analytics/summary
//  Returns chart data for the analytics dashboard
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')

router.get('/summary', async (req, res) => {
  const tenantId = req.user.tenantId
  const rangeDays = parseInt(req.query.range) || 30
  const now = new Date()
  const rangeStart = new Date(now)
  rangeStart.setDate(rangeStart.getDate() - rangeDays)

  // Each section wrapped in try/catch — one failure won't crash the rest

  // ── Documents over time ──────────────────────────────────
  let documentsOverTime = []
  try {
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
    documentsOverTime = Object.entries(docsByDate).map(([date, count]) => ({ date, count }))
  } catch (err) {
    console.error('[analytics] documentsOverTime failed:', err.message)
  }

  // ── Blockchain verifications ─────────────────────────────
  let blockchainVerifications = []
  try {
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
    blockchainVerifications = Object.entries(verByDate).map(([date, count]) => ({ date, count }))
  } catch (err) {
    console.error('[analytics] blockchainVerifications failed:', err.message)
  }

  // ── Funding vs Spent (last 6 months) ─────────────────────
  let fundingVsSpent = []
  try {
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

    fundingVsSpent = monthLabels.map(({ key, label }) => ({
      month: label,
      received: Math.round(fundingByMonth[key] || 0),
      spent: Math.round(spentByMonth[key] || 0),
    }))
  } catch (err) {
    console.error('[analytics] fundingVsSpent failed:', err.message)
  }

  // ── Expenses by project ──────────────────────────────────
  // Expense model has no category field — group by project instead
  let expensesByCategory = []
  try {
    const expByProject = await prisma.expense.groupBy({
      by: ['projectId'],
      where: { tenantId },
      _sum: { amount: true },
    })

    if (expByProject.length > 0) {
      const projectIds = expByProject.map(e => e.projectId).filter(Boolean)
      const projects = await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true },
      })
      const nameMap = {}
      for (const p of projects) nameMap[p.id] = p.name

      expensesByCategory = expByProject
        .filter(e => e.projectId)
        .map(e => ({
          category: nameMap[e.projectId] || 'Unknown',
          amount: Math.round(e._sum.amount || 0),
        }))
        .sort((a, b) => b.amount - a.amount)
    }
  } catch (err) {
    console.error('[analytics] expensesByCategory failed:', err.message)
  }

  // ── Donor engagement (best effort) ───────────────────────
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
      const engByDate = {}
      for (const du of donorUsers) {
        const date = du.createdAt.toISOString().slice(0, 10)
        engByDate[date] = (engByDate[date] || 0) + 1
      }
      donorEngagement = Object.entries(engByDate).map(([date, logins]) => ({
        date, logins, views: 0,
      }))
    }
  } catch (err) {
    console.error('[analytics] donorEngagement failed:', err.message)
  }

  // ── Totals ───────────────────────────────────────────────
  let totals = {
    totalDocuments: 0,
    totalVerified: 0,
    totalFundingReceived: 0,
    totalFundingSpent: 0,
    totalExpenses: 0,
    totalDonorLogins: 0,
  }
  try {
    const [totalDocs, totalVerified, totalExpenseSum, allAgreements] = await Promise.all([
      prisma.document.count({ where: { tenantId } }),
      prisma.auditLog.count({ where: { tenantId, entityType: 'Document', anchorStatus: 'confirmed' } }),
      prisma.expense.aggregate({ where: { tenantId }, _sum: { amount: true } }),
      prisma.fundingAgreement.aggregate({ where: { tenantId }, _sum: { totalAmount: true } }),
    ])
    totals = {
      totalDocuments: totalDocs,
      totalVerified,
      totalFundingReceived: Math.round(allAgreements._sum.totalAmount || 0),
      totalFundingSpent: Math.round(totalExpenseSum._sum.amount || 0),
      totalExpenses: Math.round(totalExpenseSum._sum.amount || 0),
      totalDonorLogins: donorEngagement.reduce((s, d) => s + d.logins, 0),
    }
  } catch (err) {
    console.error('[analytics] totals failed:', err.message)
  }

  res.json({
    documentsOverTime,
    blockchainVerifications,
    fundingVsSpent,
    expensesByCategory,
    donorEngagement,
    totals,
  })
})

// ── Income & Expenditure Statement ────────────────────────
router.get('/income-expenditure', async (req, res) => {
  const tenantId = req.user.tenantId
  const { from, to } = req.query

  const dateFilter = {}
  if (from) dateFilter.gte = new Date(from)
  if (to) dateFilter.lte = new Date(to)
  const hasDateFilter = Object.keys(dateFilter).length > 0

  try {
    // ── INCOME: Funding agreements created/active in period ──
    const agreementWhere = { tenantId }
    if (hasDateFilter) {
      agreementWhere.createdAt = dateFilter
    }
    const agreements = await prisma.fundingAgreement.findMany({
      where: agreementWhere,
      select: {
        id: true, title: true, totalAmount: true, currency: true,
        sourceType: true, sourceSubType: true, type: true,
        capexBudget: true, opexBudget: true,
        grantorName: true, grantRef: true, grantFrom: true, grantTo: true, restricted: true,
        startDate: true, endDate: true, createdAt: true,
        donor: { select: { name: true } },
      },
    })

    // Group income by sourceType
    const incomeBySource = {}
    let totalIncome = 0
    for (const a of agreements) {
      const key = a.sourceType || a.type || 'Other'
      if (!incomeBySource[key]) incomeBySource[key] = { sourceType: key, items: [], total: 0 }
      incomeBySource[key].items.push(a)
      incomeBySource[key].total += a.totalAmount
      totalIncome += a.totalAmount
    }

    // ── EXPENDITURE: Expenses in period ──
    const expenseWhere = { tenantId }
    if (hasDateFilter) {
      expenseWhere.createdAt = dateFilter
    }
    const expenses = await prisma.expense.findMany({
      where: expenseWhere,
      select: {
        id: true, description: true, amount: true, currency: true,
        expenseType: true, category: true, subCategory: true,
        fundingAgreementId: true, createdAt: true,
        fundingAgreement: { select: { id: true, title: true } },
      },
    })

    // Split by CapEx/OpEx
    let totalCapex = 0, totalOpex = 0, totalOther = 0
    const capexByCategory = {}
    const opexByCategory = {}
    const otherExpenses = []

    for (const e of expenses) {
      if (e.expenseType === 'CAPEX') {
        totalCapex += e.amount
        const cat = e.category || 'Uncategorised'
        if (!capexByCategory[cat]) capexByCategory[cat] = { category: cat, items: [], total: 0 }
        capexByCategory[cat].items.push(e)
        capexByCategory[cat].total += e.amount
      } else if (e.expenseType === 'OPEX') {
        totalOpex += e.amount
        const cat = e.category || 'Uncategorised'
        if (!opexByCategory[cat]) opexByCategory[cat] = { category: cat, items: [], total: 0 }
        opexByCategory[cat].items.push(e)
        opexByCategory[cat].total += e.amount
      } else {
        totalOther += e.amount
        otherExpenses.push(e)
      }
    }

    const totalExpenditure = totalCapex + totalOpex + totalOther

    res.json({
      period: { from: from || null, to: to || null },
      income: {
        bySource: Object.values(incomeBySource),
        total: totalIncome,
      },
      expenditure: {
        capex: { byCategory: Object.values(capexByCategory), total: totalCapex },
        opex: { byCategory: Object.values(opexByCategory), total: totalOpex },
        other: { items: otherExpenses, total: totalOther },
        total: totalExpenditure,
      },
      netBalance: totalIncome - totalExpenditure,
    })
  } catch (err) {
    console.error('[analytics] income-expenditure error:', err)
    res.status(500).json({ error: 'Failed to generate I&E statement' })
  }
})

module.exports = router
