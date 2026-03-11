// ─────────────────────────────────────────────────────────────
//  controllers/donorAuthController.js — v1
//
//  Donor-specific authentication (separate from NGO auth).
//  Authenticates against DonorUser table.
// ─────────────────────────────────────────────────────────────

const jwt    = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const prisma = require('../lib/client')

const JWT_SECRET    = process.env.JWT_SECRET
const JWT_EXPIRES   = '7d'

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

    const donorUser = await prisma.donorUser.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        donor: {
          select: {
            id: true, name: true, organisationName: true, type: true, logoUrl: true,
            fundingAgreements: {
              select: { tenantId: true, tenant: { select: { name: true } } },
              distinct: ['tenantId'],
              take: 1,
            },
          },
        },
      },
    })

    if (!donorUser) return res.status(401).json({ error: 'Invalid email or password' })
    if (!donorUser.isActive) return res.status(401).json({ error: 'Account is deactivated' })

    const valid = await bcrypt.compare(password, donorUser.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    const token = jwt.sign(
      { donorUserId: donorUser.id, donorId: donorUser.donorId, role: 'donor' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    )

    const linkedTenant = donorUser.donor?.fundingAgreements?.[0]
    res.json({
      token,
      user: {
        id: donorUser.id,
        email: donorUser.email,
        firstName: donorUser.firstName,
        lastName: donorUser.lastName,
        donorId: donorUser.donorId,
        donor: {
          id: donorUser.donor.id,
          name: donorUser.donor.name,
          organisationName: donorUser.donor.organisationName,
          type: donorUser.donor.type,
          logoUrl: donorUser.donor.logoUrl,
        },
        tenantName: linkedTenant?.tenant?.name || null,
      }
    })
  } catch (err) {
    console.error('Donor login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
}

exports.me = async (req, res) => {
  try {
    const donorUser = await prisma.donorUser.findUnique({
      where: { id: req.donorUser.donorUserId },
      include: {
        donor: {
          select: {
            id: true, name: true, organisationName: true, type: true, logoUrl: true,
            fundingAgreements: {
              select: { tenant: { select: { name: true } } },
              distinct: ['tenantId'],
              take: 1,
            },
          },
        },
      },
    })
    if (!donorUser || !donorUser.isActive) return res.status(404).json({ error: 'User not found' })

    const tenantName = donorUser.donor?.fundingAgreements?.[0]?.tenant?.name || null
    res.json({
      id: donorUser.id,
      email: donorUser.email,
      firstName: donorUser.firstName,
      lastName: donorUser.lastName,
      donorId: donorUser.donorId,
      donor: {
        id: donorUser.donor.id,
        name: donorUser.donor.name,
        organisationName: donorUser.donor.organisationName,
        type: donorUser.donor.type,
        logoUrl: donorUser.donor.logoUrl,
      },
      tenantName,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' })
  }
}

exports.dashboard = async (req, res) => {
  try {
    const { donorId } = req.donorUser

    // Funding agreements linked to this donor
    const agreements = await prisma.fundingAgreement.findMany({
      where: { donorId },
      include: {
        tenant: { select: { id: true, name: true } },
        projectFunding: {
          include: { project: { select: { id: true, name: true, status: true } } }
        },
        _count: { select: { expenses: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Compute spent per agreement
    const ids = agreements.map(a => a.id)
    const spentRaw = ids.length > 0
      ? await prisma.expense.groupBy({
          by: ['fundingAgreementId'],
          where: { fundingAgreementId: { in: ids } },
          _sum: { amount: true }
        })
      : []
    const spentMap = {}
    for (const r of spentRaw) spentMap[r.fundingAgreementId] = Number(r._sum.amount || 0)

    const enrichedAgreements = agreements.map(a => ({
      ...a,
      spent: spentMap[a.id] || 0,
    }))

    // Documents from projects linked to donor's funding agreements
    const projectIds = new Set()
    for (const a of agreements) {
      for (const pf of a.projectFunding) {
        projectIds.add(pf.project.id)
      }
    }

    const documents = projectIds.size > 0
      ? await prisma.document.findMany({
          where: { projectId: { in: [...projectIds] } },
          select: {
            id: true, name: true, fileType: true, documentLevel: true,
            uploadedAt: true, sha256Hash: true,
            project: { select: { id: true, name: true } }
          },
          orderBy: { uploadedAt: 'desc' },
          take: 50
        })
      : []

    // Summary stats
    const totalFunding = agreements.reduce((s, a) => s + a.totalAmount, 0)
    const totalSpent = enrichedAgreements.reduce((s, a) => s + a.spent, 0)

    res.json({
      summary: {
        totalAgreements: agreements.length,
        totalFunding,
        totalSpent,
        totalProjects: projectIds.size,
        totalDocuments: documents.length,
      },
      agreements: enrichedAgreements,
      documents,
    })
  } catch (err) {
    console.error('Donor dashboard error:', err)
    res.status(500).json({ error: 'Failed to load dashboard' })
  }
}

exports.incomeExpenditure = async (req, res) => {
  try {
    const { donorId } = req.donorUser
    const { from, to } = req.query

    // Get all agreements for this donor
    const agreements = await prisma.fundingAgreement.findMany({
      where: { donorId },
      select: {
        id: true, title: true, totalAmount: true, currency: true,
        sourceType: true, sourceSubType: true, type: true,
        capexBudget: true, opexBudget: true,
        grantorName: true, grantRef: true, grantFrom: true, grantTo: true, restricted: true,
        startDate: true, endDate: true, createdAt: true,
        tenant: { select: { id: true, name: true } },
      },
    })

    // Get expenses linked to these agreements
    const ids = agreements.map(a => a.id)
    const expenseWhere = { fundingAgreementId: { in: ids } }
    if (from) expenseWhere.createdAt = { ...expenseWhere.createdAt, gte: new Date(from) }
    if (to) expenseWhere.createdAt = { ...expenseWhere.createdAt, lte: new Date(to) }

    const expenses = ids.length > 0
      ? await prisma.expense.findMany({
          where: expenseWhere,
          select: {
            id: true, description: true, amount: true, currency: true,
            expenseType: true, category: true, subCategory: true,
            fundingAgreementId: true, createdAt: true,
          },
        })
      : []

    // Group income
    let totalIncome = 0
    const incomeBySource = {}
    for (const a of agreements) {
      const key = a.sourceType || a.type || 'Other'
      if (!incomeBySource[key]) incomeBySource[key] = { sourceType: key, items: [], total: 0 }
      incomeBySource[key].items.push(a)
      incomeBySource[key].total += a.totalAmount
      totalIncome += a.totalAmount
    }

    // Group expenses
    let totalCapex = 0, totalOpex = 0, totalOther = 0
    const capexByCategory = {}
    const opexByCategory = {}

    for (const e of expenses) {
      if (e.expenseType === 'CAPEX') {
        totalCapex += e.amount
        const cat = e.category || 'Uncategorised'
        if (!capexByCategory[cat]) capexByCategory[cat] = { category: cat, total: 0 }
        capexByCategory[cat].total += e.amount
      } else if (e.expenseType === 'OPEX') {
        totalOpex += e.amount
        const cat = e.category || 'Uncategorised'
        if (!opexByCategory[cat]) opexByCategory[cat] = { category: cat, total: 0 }
        opexByCategory[cat].total += e.amount
      } else {
        totalOther += e.amount
      }
    }

    const totalExpenditure = totalCapex + totalOpex + totalOther

    res.json({
      period: { from: from || null, to: to || null },
      income: { bySource: Object.values(incomeBySource), total: totalIncome },
      expenditure: {
        capex: { byCategory: Object.values(capexByCategory), total: totalCapex },
        opex: { byCategory: Object.values(opexByCategory), total: totalOpex },
        other: { total: totalOther },
        total: totalExpenditure,
      },
      netBalance: totalIncome - totalExpenditure,
    })
  } catch (err) {
    console.error('Donor I&E error:', err)
    res.status(500).json({ error: 'Failed to generate I&E statement' })
  }
}
