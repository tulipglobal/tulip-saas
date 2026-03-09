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
      include: { donor: { select: { id: true, name: true, organisationName: true, type: true, logoUrl: true } } }
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

    res.json({
      token,
      user: {
        id: donorUser.id,
        email: donorUser.email,
        firstName: donorUser.firstName,
        lastName: donorUser.lastName,
        donorId: donorUser.donorId,
        donor: donorUser.donor,
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
      include: { donor: { select: { id: true, name: true, organisationName: true, type: true, logoUrl: true } } }
    })
    if (!donorUser || !donorUser.isActive) return res.status(404).json({ error: 'User not found' })

    res.json({
      id: donorUser.id,
      email: donorUser.email,
      firstName: donorUser.firstName,
      lastName: donorUser.lastName,
      donorId: donorUser.donorId,
      donor: donorUser.donor,
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
