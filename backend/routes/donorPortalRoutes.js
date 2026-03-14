// ─────────────────────────────────────────────────────────────
//  routes/donorPortalRoutes.js — Donor Portal Sprint 1 (v2)
//
//  Unified donor portal API routes.
//  Uses raw SQL for DonorOrganisation/DonorMember/DonorProjectAccess
//  and Prisma client for existing models (Project, Expense, etc.)
//
//  v2: Fix duplicate accounts, add access management endpoints
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')
const { sendEmail } = require('../services/emailService')

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES = '7d'

// ── Completion % helper ──────────────────────────────────────
function calcCompletion(project, totalSpent, totalFunded) {
  const now = new Date()
  const startDate = project.startDate ? new Date(project.startDate) : null
  const endDate = project.endDate ? new Date(project.endDate) : null
  const isClosed = (project.status || '').toUpperCase() === 'CLOSED' || (project.status || '').toUpperCase() === 'COMPLETED'
  const hasEndDate = !!endDate
  const isOverdue = hasEndDate && now > endDate && !isClosed

  // Time %
  let timePercent = null
  if (startDate && endDate) {
    const totalDuration = endDate.getTime() - startDate.getTime()
    const elapsed = now.getTime() - startDate.getTime()
    if (totalDuration > 0) {
      timePercent = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100)
    }
  }

  // Financial %
  let financialPercent = null
  if (totalFunded > 0) {
    financialPercent = Math.min(Math.max((totalSpent / totalFunded) * 100, 0), 100)
  }

  // Combined
  let completionPercent = 0
  if (timePercent !== null && financialPercent !== null) {
    completionPercent = (timePercent + financialPercent) / 2
  } else if (timePercent !== null) {
    completionPercent = timePercent
  } else if (financialPercent !== null) {
    completionPercent = financialPercent
  }
  completionPercent = Math.min(Math.max(completionPercent, 0), 100)

  return {
    timePercent: timePercent !== null ? Math.round(timePercent * 10) / 10 : null,
    financialPercent: financialPercent !== null ? Math.round(financialPercent * 10) / 10 : null,
    completionPercent: Math.round(completionPercent * 10) / 10,
    isOverdue,
    isClosed,
    hasEndDate,
    startDate: project.startDate,
    endDate: project.endDate,
  }
}

// ── Donor JWT middleware ──────────────────────────────────────
function donorAuth(req, res, next) {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  const token = authHeader.slice(7).trim()
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    if (decoded.role !== 'DONOR' || !decoded.donorMemberId) {
      return res.status(401).json({ error: 'Invalid donor token' })
    }
    req.donor = decoded
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ── POST /api/donor/auth/login ────────────────────────────────
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

    const members = await prisma.$queryRawUnsafe(
      `SELECT m.*, o.name as "orgName", o.type as "orgType", o.country as "orgCountry"
       FROM "DonorMember" m
       LEFT JOIN "DonorOrganisation" o ON m."donorOrgId" = o.id
       WHERE m.email = $1`,
      email.toLowerCase().trim()
    )
    if (!members.length) return res.status(401).json({ error: 'Invalid email or password' })

    const member = members[0]
    const valid = await bcrypt.compare(password, member.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    // Update lastLoginAt
    await prisma.$executeRawUnsafe(
      `UPDATE "DonorMember" SET "lastLoginAt" = NOW() WHERE id = $1`,
      member.id
    )

    const token = jwt.sign(
      { donorMemberId: member.id, donorOrgId: member.donorOrgId, email: member.email, role: 'DONOR' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    )

    res.json({
      token,
      user: {
        id: member.id,
        email: member.email,
        name: member.name,
        donorOrgId: member.donorOrgId,
        orgName: member.orgName,
        orgType: member.orgType,
      }
    })
  } catch (err) {
    console.error('Donor portal login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// ── POST /api/donor/auth/invite/accept ────────────────────────
// FIX 1: Prevent duplicate accounts — reuse existing DonorMember
router.post('/auth/invite/accept', async (req, res) => {
  try {
    const { token, name, password } = req.body
    if (!token || !name || !password) {
      return res.status(400).json({ error: 'token, name, and password are required' })
    }

    // Find invite (try Prisma table first)
    const invite = await prisma.donorInvite.findUnique({ where: { token } })
    if (!invite) return res.status(404).json({ error: 'Invite not found' })
    if (invite.status !== 'PENDING') return res.status(400).json({ error: 'Invite already used' })
    if (new Date() > invite.expiresAt) {
      await prisma.donorInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } })
      return res.status(400).json({ error: 'Invite has expired' })
    }

    // Parse metadata from inviteType JSON
    let donorOrgName = ''
    let projectIds = []
    try {
      const meta = JSON.parse(invite.inviteType)
      donorOrgName = meta.donorOrgName || ''
      projectIds = meta.projectIds || []
    } catch {
      donorOrgName = invite.email
      projectIds = invite.projectId ? [invite.projectId] : []
    }

    // Create or find DonorOrganisation
    let orgRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "DonorOrganisation" WHERE name = $1 LIMIT 1`,
      donorOrgName
    )
    let orgId
    if (orgRows.length) {
      orgId = orgRows[0].id
    } else {
      const newOrg = await prisma.$queryRawUnsafe(
        `INSERT INTO "DonorOrganisation" (name) VALUES ($1) RETURNING id`,
        donorOrgName
      )
      orgId = newOrg[0].id
    }

    // FIX 1: Check if DonorMember already exists — reuse if so
    const existingMember = await prisma.$queryRawUnsafe(
      `SELECT id, "donorOrgId" FROM "DonorMember" WHERE email = $1`,
      invite.email.toLowerCase().trim()
    )

    let memberId
    let memberOrgId = orgId
    if (existingMember.length) {
      // Existing account — do NOT overwrite password or org
      memberId = existingMember[0].id
      memberOrgId = existingMember[0].donorOrgId
    } else {
      // New account — create DonorMember
      const passwordHash = await bcrypt.hash(password, 10)
      const newMember = await prisma.$queryRawUnsafe(
        `INSERT INTO "DonorMember" (email, name, "passwordHash", "donorOrgId")
         VALUES ($1, $2, $3, $4) RETURNING id`,
        invite.email.toLowerCase().trim(), name, passwordHash, orgId
      )
      memberId = newMember[0].id
    }

    // Create DonorProjectAccess rows (upsert — restore if previously revoked)
    for (const projectId of projectIds) {
      if (!projectId) continue
      await prisma.$executeRawUnsafe(
        `INSERT INTO "DonorProjectAccess" ("donorOrgId", "projectId", "tenantId", "grantedBy")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("donorOrgId", "projectId") DO UPDATE SET "revokedAt" = NULL, "grantedAt" = NOW()`,
        memberOrgId, projectId, invite.tenantId, invite.invitedByUserId || 'system'
      )
    }

    // Mark invite accepted
    await prisma.donorInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED' }
    })

    const jwtToken = jwt.sign(
      { donorMemberId: memberId, donorOrgId: memberOrgId, email: invite.email, role: 'DONOR' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    )

    // Get org name for response
    const orgInfo = await prisma.$queryRawUnsafe(
      `SELECT name FROM "DonorOrganisation" WHERE id = $1`, memberOrgId
    )

    res.json({
      token: jwtToken,
      user: {
        id: memberId,
        email: invite.email,
        name: existingMember.length ? undefined : name,
        donorOrgId: memberOrgId,
        orgName: orgInfo[0]?.name || donorOrgName,
        existingAccount: existingMember.length > 0,
      }
    })
  } catch (err) {
    console.error('Donor invite accept error:', err)
    res.status(500).json({ error: 'Failed to accept invite' })
  }
})

// ── GET /api/donor/me ─────────────────────────────────────────
router.get('/me', donorAuth, async (req, res) => {
  try {
    const members = await prisma.$queryRawUnsafe(
      `SELECT m.*, o.name as "orgName", o.type as "orgType", o.country as "orgCountry", o.website as "orgWebsite"
       FROM "DonorMember" m
       LEFT JOIN "DonorOrganisation" o ON m."donorOrgId" = o.id
       WHERE m.id = $1`,
      req.donor.donorMemberId
    )
    if (!members.length) return res.status(404).json({ error: 'User not found' })

    const m = members[0]
    res.json({
      id: m.id,
      email: m.email,
      name: m.name,
      donorOrgId: m.donorOrgId,
      preferredLanguage: m.preferredLanguage,
      lastLoginAt: m.lastLoginAt,
      org: { id: m.donorOrgId, name: m.orgName, type: m.orgType, country: m.orgCountry, website: m.orgWebsite }
    })
  } catch (err) {
    console.error('Donor me error:', err)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// ── GET /api/donor/projects ───────────────────────────────────
// FIX 4: Query by donorOrgId from JWT — merges all access across invites
router.get('/projects', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor

    // Get all active project access for this org
    const accessRows = await prisma.$queryRawUnsafe(
      `SELECT "projectId", "tenantId" FROM "DonorProjectAccess"
       WHERE "donorOrgId" = $1 AND "revokedAt" IS NULL`,
      donorOrgId
    )

    if (!accessRows.length) {
      return res.json({ ngos: [] })
    }

    const projectIds = accessRows.map(r => r.projectId)
    const tenantIds = [...new Set(accessRows.map(r => r.tenantId))]

    // Fetch projects
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true, name: true, description: true, budget: true, status: true,
        startDate: true, endDate: true,
        tenantId: true,
        _count: { select: { expenses: true, documents: true } }
      }
    })

    // Fetch tenant names
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true }
    })
    const tenantMap = {}
    for (const t of tenants) tenantMap[t.id] = t.name

    // Get expense stats per project (approved only)
    const expenseStats = projectIds.length > 0
      ? await prisma.expense.groupBy({
          by: ['projectId'],
          where: {
            projectId: { in: projectIds },
            approvalStatus: { in: ['APPROVED', 'AUTO_APPROVED'] }
          },
          _sum: { amount: true },
          _count: true
        })
      : []
    const expenseMap = {}
    for (const e of expenseStats) {
      expenseMap[e.projectId] = { spent: Number(e._sum.amount || 0), count: e._count }
    }

    // Get seal counts per project
    let sealMap = {}
    try {
      const sealCounts = await prisma.$queryRawUnsafe(
        `SELECT e."projectId", COUNT(CASE WHEN e."receiptSealId" IS NOT NULL THEN 1 END)::int as "sealCount"
         FROM "Expense" e WHERE e."projectId" = ANY($1::text[]) GROUP BY e."projectId"`,
        projectIds
      )
      for (const s of sealCounts) sealMap[s.projectId] = s.sealCount
    } catch { /* seal column may not exist */ }

    // Get flag counts (HIGH fraud risk)
    let flagMap = {}
    try {
      const flagCounts = await prisma.expense.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          fraudRiskLevel: { in: ['HIGH', 'CRITICAL'] }
        },
        _count: true
      })
      for (const f of flagCounts) flagMap[f.projectId] = f._count
    } catch { /* fraudRiskLevel may not exist */ }

    // Get real budget totals from BudgetLine (sum of approvedAmount per project)
    let budgetMap = {}
    try {
      const budgetTotals = await prisma.$queryRawUnsafe(
        `SELECT b."projectId", COALESCE(SUM(bl."approvedAmount"), 0)::float as "totalBudget"
         FROM "Budget" b
         JOIN "BudgetLine" bl ON bl."budgetId" = b.id
         WHERE b."projectId" = ANY($1::text[])
         GROUP BY b."projectId"`,
        projectIds
      )
      for (const bt of budgetTotals) budgetMap[bt.projectId] = bt.totalBudget
    } catch { /* budget tables may not exist */ }

    // Get real funding totals from FundingAgreement via ProjectFunding
    let fundingMap = {}
    try {
      const fundingTotals = await prisma.$queryRawUnsafe(
        `SELECT pf."projectId", COALESCE(SUM(pf."allocatedAmount"), 0)::float as "totalFunded"
         FROM "ProjectFunding" pf
         WHERE pf."projectId" = ANY($1::text[])
         GROUP BY pf."projectId"`,
        projectIds
      )
      for (const ft of fundingTotals) fundingMap[ft.projectId] = ft.totalFunded
    } catch { /* ProjectFunding may not exist */ }

    // Get fraud prevented value (sum of HIGH/CRITICAL blocked expenses)
    let fraudPrevented = 0
    try {
      const blocked = await prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(e.amount), 0)::float as total
         FROM "Expense" e
         WHERE e."projectId" = ANY($1::text[])
           AND e."fraudRiskLevel" IN ('HIGH', 'CRITICAL')
           AND e."approvalStatus" = 'REJECTED'`,
        projectIds
      )
      fraudPrevented = blocked[0]?.total || 0
    } catch { /* may fail */ }

    // Also count blocked expenses that were never saved (audit log approach)
    try {
      const blockedAudit = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count
         FROM "AuditLog" al
         WHERE al."tenantId" = ANY($1::text[])
           AND al.action = 'EXPENSE_BLOCKED_FRAUD'`,
        tenantIds
      )
      // If we got audit counts but no rejected amounts, estimate
      if (fraudPrevented === 0 && blockedAudit[0]?.count > 0) {
        fraudPrevented = 0 // We can't recover amounts from audit logs alone
      }
    } catch { /* may fail */ }

    // Group by NGO
    const ngoMap = {}
    for (const p of projects) {
      if (!ngoMap[p.tenantId]) {
        ngoMap[p.tenantId] = {
          tenantId: p.tenantId,
          tenantName: tenantMap[p.tenantId] || 'Unknown',
          projects: []
        }
      }
      const realBudget = budgetMap[p.id] || p.budget || 0
      const realFunded = fundingMap[p.id] || 0
      const spent = expenseMap[p.id]?.spent || 0
      const completion = calcCompletion(p, spent, realFunded)
      ngoMap[p.tenantId].projects.push({
        id: p.id,
        name: p.name,
        description: p.description,
        budget: realBudget,
        funded: realFunded,
        status: p.status,
        expenseCount: expenseMap[p.id]?.count || 0,
        spent,
        sealCount: sealMap[p.id] || 0,
        flagCount: flagMap[p.id] || 0,
        documentCount: p._count.documents,
        ...completion,
      })
    }

    // Calculate NGO completion averages
    const ngoList = Object.values(ngoMap)
    for (const ngo of ngoList) {
      const active = ngo.projects.filter(p => !p.isClosed)
      if (active.length > 0) {
        ngo.ngoCompletionPercent = Math.round((active.reduce((s, p) => s + p.completionPercent, 0) / active.length) * 10) / 10
      } else {
        ngo.ngoCompletionPercent = 0
      }
    }

    res.json({ ngos: ngoList, fraudPrevented })
  } catch (err) {
    console.error('Donor projects error:', err)
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
})

// ── GET /api/donor/projects/:projectId ────────────────────────
router.get('/projects/:projectId', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor
    const { projectId } = req.params

    // Verify access
    const access = await prisma.$queryRawUnsafe(
      `SELECT id FROM "DonorProjectAccess"
       WHERE "donorOrgId" = $1 AND "projectId" = $2 AND "revokedAt" IS NULL`,
      donorOrgId, projectId
    )
    if (!access.length) return res.status(403).json({ error: 'No access to this project' })

    // Fetch project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        expenses: {
          where: { approvalStatus: { in: ['APPROVED', 'AUTO_APPROVED'] } },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, description: true, amount: true, currency: true,
            category: true, expenseType: true, createdAt: true,
            ocrVendor: true, ocrDate: true,
            fraudRiskLevel: true, fraudRiskScore: true,
            receiptSealId: true, approvalStatus: true,
          }
        }
      }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    // Get seal/anchor data for expenses that have sealIds
    const sealIds = project.expenses.filter(e => e.receiptSealId).map(e => e.receiptSealId)
    let sealMap = {}
    if (sealIds.length) {
      try {
        const seals = await prisma.trustSeal.findMany({
          where: { id: { in: sealIds } },
          select: { id: true, status: true, anchorTxHash: true }
        })
        for (const s of seals) sealMap[s.id] = s
      } catch { /* trustSeal may not exist */ }
    }

    // Get real budget total from BudgetLine table
    let totalBudget = 0
    try {
      const budgetResult = await prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(bl."approvedAmount"), 0)::float as "totalBudget"
         FROM "Budget" b
         JOIN "BudgetLine" bl ON bl."budgetId" = b.id
         WHERE b."projectId" = $1`,
        projectId
      )
      totalBudget = budgetResult[0]?.totalBudget || 0
    } catch { /* budget tables may not exist */ }

    // Get real funding total from ProjectFunding table
    let totalFunded = 0
    try {
      const fundingResult = await prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(pf."allocatedAmount"), 0)::float as "totalFunded"
         FROM "ProjectFunding" pf
         WHERE pf."projectId" = $1`,
        projectId
      )
      totalFunded = fundingResult[0]?.totalFunded || 0
    } catch { /* ProjectFunding may not exist */ }

    // Get funding sources from FundingAgreement via ProjectFunding
    let fundingSources = []
    try {
      fundingSources = await prisma.$queryRawUnsafe(
        `SELECT fa.id, fa."funderName" as name, pf."allocatedAmount" as amount,
                fa.currency, fa."agreementType" as type
         FROM "ProjectFunding" pf
         JOIN "FundingAgreement" fa ON fa.id = pf."fundingAgreementId"
         WHERE pf."projectId" = $1`,
        projectId
      )
    } catch { /* tables may not exist */ }

    const totalSpent = project.expenses.reduce((s, e) => s + (e.amount || 0), 0)

    const expenses = project.expenses.map(e => ({
      id: e.id,
      date: e.ocrDate || e.createdAt,
      vendor: e.ocrVendor || e.description,
      amount: e.amount,
      currency: e.currency,
      category: e.category || e.expenseType || 'Other',
      fraudRiskLevel: e.fraudRiskLevel || 'LOW',
      sealId: e.receiptSealId || null,
      sealStatus: e.receiptSealId ? (sealMap[e.receiptSealId]?.status || 'ISSUED') : null,
      anchorTxHash: e.receiptSealId ? (sealMap[e.receiptSealId]?.anchorTxHash || null) : null,
    }))

    const completion = calcCompletion(project, totalSpent, totalFunded)

    res.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        budget: totalBudget,
        funded: totalFunded,
        spent: totalSpent,
        remaining: totalBudget - totalSpent,
        ...completion,
      },
      fundingSources,
      expenses,
    })
  } catch (err) {
    console.error('Donor project detail error:', err)
    res.status(500).json({ error: 'Failed to fetch project' })
  }
})

// ── GET /api/donor/projects/:projectId/expenses/:expenseId ────
router.get('/projects/:projectId/expenses/:expenseId', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor
    const { projectId, expenseId } = req.params

    // Verify access
    const access = await prisma.$queryRawUnsafe(
      `SELECT id FROM "DonorProjectAccess"
       WHERE "donorOrgId" = $1 AND "projectId" = $2 AND "revokedAt" IS NULL`,
      donorOrgId, projectId
    )
    if (!access.length) return res.status(403).json({ error: 'No access to this project' })

    // Fetch expense with full detail
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        project: { select: { id: true, name: true } },
      }
    })
    if (!expense || expense.projectId !== projectId) {
      return res.status(404).json({ error: 'Expense not found' })
    }

    // Get seal data
    let seal = null
    if (expense.receiptSealId) {
      try {
        seal = await prisma.trustSeal.findUnique({
          where: { id: expense.receiptSealId },
          select: {
            id: true, status: true, rawHash: true, anchorTxHash: true,
            anchoredAt: true, blockNumber: true,
          }
        })
      } catch { /* trustSeal may not exist */ }
    }

    // Generate presigned URL for receipt
    let receiptUrl = null
    if (expense.receiptFileKey) {
      try {
        const { getPresignedUrlFromKey } = require('../lib/s3Upload')
        receiptUrl = await getPresignedUrlFromKey(expense.receiptFileKey, 3600)
      } catch { /* S3 may fail */ }
    }

    // Build OCR comparison table
    const ocrComparison = [
      {
        field: 'Amount',
        ocr: expense.ocrAmount != null ? expense.ocrAmount : null,
        submitted: expense.amount,
        match: !expense.amountMismatch,
      },
      {
        field: 'Vendor',
        ocr: expense.ocrVendor || null,
        submitted: expense.vendor || expense.description,
        match: !expense.vendorMismatch,
      },
      {
        field: 'Date',
        ocr: expense.ocrDate || null,
        submitted: expense.createdAt,
        match: !expense.dateMismatch,
      },
    ]

    // Build fraud flags
    const fraudFlags = []
    if (expense.amountMismatch) fraudFlags.push({ type: 'AMOUNT_MISMATCH', level: 'MEDIUM', message: `OCR amount (${expense.ocrAmount}) differs from submitted (${expense.amount})` })
    if (expense.vendorMismatch) fraudFlags.push({ type: 'VENDOR_MISMATCH', level: 'MEDIUM', message: `OCR vendor (${expense.ocrVendor}) differs from submitted (${expense.vendor || expense.description})` })
    if (expense.dateMismatch) fraudFlags.push({ type: 'DATE_MISMATCH', level: 'MEDIUM', message: `OCR date (${expense.ocrDate}) differs from submitted date` })

    // Parse fraudSignals JSON for additional flags
    if (expense.fraudSignals) {
      try {
        const signals = typeof expense.fraudSignals === 'string' ? JSON.parse(expense.fraudSignals) : expense.fraudSignals
        if (Array.isArray(signals)) {
          for (const sig of signals) {
            fraudFlags.push({ type: sig.type || sig.name || 'FRAUD_SIGNAL', level: expense.fraudRiskLevel || 'MEDIUM', message: sig.message || sig.description || sig.name || JSON.stringify(sig) })
          }
        }
      } catch { /* ignore parse errors */ }
    }

    res.json({
      expense: {
        id: expense.id,
        date: expense.ocrDate || expense.createdAt,
        createdAt: expense.createdAt,
        vendor: expense.vendor || expense.description,
        description: expense.description,
        amount: expense.amount,
        currency: expense.currency,
        category: expense.category || expense.expenseType || 'Other',
        subCategory: expense.subCategory || null,
        projectName: expense.project?.name || '',
        fraudRiskScore: expense.fraudRiskScore || 0,
        fraudRiskLevel: expense.fraudRiskLevel || 'LOW',
        approvalStatus: expense.approvalStatus,
      },
      ocrComparison,
      fraudFlags,
      seal: seal ? {
        id: seal.id,
        hash: seal.rawHash,
        status: seal.status,
        anchorTxHash: seal.anchorTxHash,
        anchoredAt: seal.anchoredAt,
        blockNumber: seal.blockNumber,
      } : null,
      receiptUrl,
    })
  } catch (err) {
    console.error('Donor expense detail error:', err)
    res.status(500).json({ error: 'Failed to fetch expense detail' })
  }
})

// ── GET /api/donor/projects/:projectId/budget ─────────────────
router.get('/projects/:projectId/budget', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor
    const { projectId } = req.params

    // Verify access
    const access = await prisma.$queryRawUnsafe(
      `SELECT id FROM "DonorProjectAccess"
       WHERE "donorOrgId" = $1 AND "projectId" = $2 AND "revokedAt" IS NULL`,
      donorOrgId, projectId
    )
    if (!access.length) return res.status(403).json({ error: 'No access to this project' })

    // Budget lines grouped by category
    let budgetLines = []
    try {
      budgetLines = await prisma.$queryRawUnsafe(
        `SELECT bl.id, bl.category, bl."subCategory", bl."expenseType",
                bl."approvedAmount"::float as budget, bl.currency
         FROM "BudgetLine" bl
         JOIN "Budget" b ON bl."budgetId" = b.id
         WHERE b."projectId" = $1
         ORDER BY bl.category`,
        projectId
      )
    } catch { /* tables may not exist */ }

    // Actual spend per category from expenses
    let spendByCategory = []
    try {
      spendByCategory = await prisma.$queryRawUnsafe(
        `SELECT COALESCE(e.category, e."expenseType", 'Other') as category,
                SUM(e.amount)::float as spent,
                COUNT(*)::int as count
         FROM "Expense" e
         WHERE e."projectId" = $1
           AND e."approvalStatus" IN ('APPROVED', 'AUTO_APPROVED')
         GROUP BY COALESCE(e.category, e."expenseType", 'Other')`,
        projectId
      )
    } catch { /* may fail */ }

    const spendMap = {}
    for (const s of spendByCategory) spendMap[s.category] = s.spent

    // Merge budget lines with spend
    const categories = budgetLines.map(bl => {
      const spent = spendMap[bl.category] || 0
      const remaining = bl.budget - spent
      const pctUsed = bl.budget > 0 ? Math.round((spent / bl.budget) * 100) : 0
      return {
        id: bl.id,
        category: bl.category,
        subCategory: bl.subCategory,
        expenseType: bl.expenseType,
        budget: bl.budget,
        spent,
        remaining,
        pctUsed,
        currency: bl.currency,
      }
    })

    // If no budget lines, show spend by category as unbudgeted
    if (!budgetLines.length && spendByCategory.length) {
      for (const s of spendByCategory) {
        categories.push({
          id: null,
          category: s.category,
          subCategory: null,
          expenseType: null,
          budget: 0,
          spent: s.spent,
          remaining: -s.spent,
          pctUsed: 100,
          currency: 'USD',
        })
      }
    }

    // Monthly spend for last 6 months
    let monthlySpend = []
    try {
      monthlySpend = await prisma.$queryRawUnsafe(
        `SELECT TO_CHAR(DATE_TRUNC('month', e."createdAt"), 'YYYY-MM') as month,
                SUM(e.amount)::float as spent
         FROM "Expense" e
         WHERE e."projectId" = $1
           AND e."approvalStatus" IN ('APPROVED', 'AUTO_APPROVED')
           AND e."createdAt" >= NOW() - INTERVAL '6 months'
         GROUP BY DATE_TRUNC('month', e."createdAt")
         ORDER BY DATE_TRUNC('month', e."createdAt")`,
        projectId
      )
    } catch { /* may fail */ }

    // Compute total budget and total spent for overrun projection
    const totalBudget = categories.reduce((s, c) => s + (c.budget || 0), 0)
    const totalSpent = categories.reduce((s, c) => s + (c.spent || 0), 0)

    // Project overrun: calculate months of data, average burn
    let projectedOverrunDate = null
    if (monthlySpend.length >= 2 && totalBudget > 0) {
      const avgMonthlyBurn = monthlySpend.reduce((s, m) => s + m.spent, 0) / monthlySpend.length
      if (avgMonthlyBurn > 0) {
        const remainingBudget = totalBudget - totalSpent
        if (remainingBudget > 0) {
          const monthsLeft = remainingBudget / avgMonthlyBurn
          const overrunDate = new Date()
          overrunDate.setMonth(overrunDate.getMonth() + Math.floor(monthsLeft))
          projectedOverrunDate = overrunDate.toISOString()
        } else {
          projectedOverrunDate = new Date().toISOString() // already overrun
        }
      }
    }

    res.json({
      categories,
      monthlySpend,
      totalBudget,
      totalSpent,
      remaining: totalBudget - totalSpent,
      projectedOverrunDate,
    })
  } catch (err) {
    console.error('Donor budget error:', err)
    res.status(500).json({ error: 'Failed to fetch budget data' })
  }
})

// ── GET /api/donor/activity ──────────────────────────────────
router.get('/activity', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor

    // Get all project IDs and their tenant IDs this donor can access
    const accessRows = await prisma.$queryRawUnsafe(
      `SELECT "projectId", "tenantId" FROM "DonorProjectAccess"
       WHERE "donorOrgId" = $1 AND "revokedAt" IS NULL`,
      donorOrgId
    )

    if (!accessRows.length) return res.json({ events: [] })

    const projectIds = accessRows.map(r => r.projectId)
    const tenantIds = [...new Set(accessRows.map(r => r.tenantId))]

    // Get recent audit logs for these projects
    const logs = await prisma.$queryRawUnsafe(
      `SELECT al.id, al.action, al."entityType", al."entityId",
              al."createdAt", al."tenantId"
       FROM "AuditLog" al
       WHERE al."tenantId" = ANY($1::text[])
         AND al."entityType" IN ('Expense', 'Document')
         AND al."entityId" IN (
           SELECT e.id FROM "Expense" e WHERE e."projectId" = ANY($2::text[])
           UNION ALL
           SELECT d.id FROM "Document" d WHERE d."projectId" = ANY($2::text[])
         )
       ORDER BY al."createdAt" DESC
       LIMIT 20`,
      tenantIds, projectIds
    )

    // Enrich with expense/document data
    const expenseIds = logs.filter(l => l.entityType === 'Expense').map(l => l.entityId)
    const documentIds = logs.filter(l => l.entityType === 'Document').map(l => l.entityId)

    let expenseMap = {}
    if (expenseIds.length) {
      const expenses = await prisma.expense.findMany({
        where: { id: { in: expenseIds } },
        select: { id: true, vendor: true, description: true, amount: true, currency: true, projectId: true, fraudRiskLevel: true }
      })
      for (const e of expenses) expenseMap[e.id] = e
    }

    let documentMap = {}
    if (documentIds.length) {
      const docs = await prisma.document.findMany({
        where: { id: { in: documentIds } },
        select: { id: true, title: true, projectId: true }
      })
      for (const d of docs) documentMap[d.id] = d
    }

    // Get project names
    const projectMap = {}
    if (projectIds.length) {
      const projects = await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true }
      })
      for (const p of projects) projectMap[p.id] = p.name
    }

    const events = logs.map(log => {
      const expense = expenseMap[log.entityId]
      const document = documentMap[log.entityId]
      const pId = expense?.projectId || document?.projectId || null
      const projectName = pId ? (projectMap[pId] || 'Unknown') : 'Unknown'

      let icon = 'activity'
      let description = log.action

      if (log.action === 'EXPENSE_CREATED') {
        icon = 'expense'
        description = `Expense submitted: ${expense?.vendor || expense?.description || 'Unknown'} — ${expense?.currency || '$'} ${(expense?.amount || 0).toLocaleString()}`
      } else if (log.action === 'EXPENSE_APPROVED' || log.action === 'AUTO_APPROVED') {
        icon = 'approved'
        description = `Expense approved: ${expense?.vendor || expense?.description || 'Unknown'} — ${expense?.currency || '$'} ${(expense?.amount || 0).toLocaleString()}`
      } else if (log.action === 'DOCUMENT_UPLOADED') {
        icon = 'document'
        description = `Document uploaded: ${document?.title || 'Untitled'}`
      } else if (log.action === 'FRAUD_RISK_SCORED') {
        icon = 'fraud'
        description = `Fraud flag: ${expense?.vendor || expense?.description || 'Unknown'} — ${expense?.currency || '$'} ${(expense?.amount || 0).toLocaleString()} (${expense?.fraudRiskLevel || 'MEDIUM'})`
      } else if (log.action === 'EXPENSE_BLOCKED_FRAUD') {
        icon = 'blocked'
        description = `Expense blocked: ${expense?.vendor || expense?.description || 'Unknown'} — ${expense?.currency || '$'} ${(expense?.amount || 0).toLocaleString()}`
      } else if (log.action === 'SEAL_ANCHORED' || log.action === 'TRUST_SEAL_ISSUED') {
        icon = 'seal'
        description = `Seal anchored for ${log.entityType === 'Expense' ? 'expense' : 'document'}`
      }

      return {
        id: log.id,
        action: log.action,
        icon,
        description,
        projectId: pId,
        projectName,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: log.createdAt,
      }
    })

    res.json({ events })
  } catch (err) {
    console.error('Donor activity error:', err)
    res.status(500).json({ error: 'Failed to fetch activity' })
  }
})

// ── POST /api/donor/invite (NGO JWT) ──────────────────────────
router.post('/invite', authenticate, tenantScope, async (req, res) => {
  try {
    const { email, donorOrgName, projectIds, message } = req.body
    if (!email || !donorOrgName || !projectIds?.length) {
      return res.status(400).json({ error: 'email, donorOrgName, and projectIds are required' })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // Create DonorInvite in the existing Prisma table
    const invite = await prisma.donorInvite.create({
      data: {
        token,
        email: email.toLowerCase().trim(),
        invitedByUserId: req.user.userId,
        inviteType: 'NGO_INVITES_DONOR',
        tenantId: req.user.tenantId,
        projectId: projectIds[0],
        expiresAt,
      }
    })

    // Get tenant name
    const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId }, select: { name: true } })
    const tenantName = tenant?.name || 'An organisation'

    // Get project names for email
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { name: true }
    })
    const projectNames = projects.map(p => p.name).join(', ')

    // Send invite email with Sealayer purple branding
    const inviteUrl = `https://donor.sealayer.io/signup?token=${token}`
    try {
      await sendEmail({
        to: email,
        subject: `${tenantName} has shared project access with you on Sealayer`,
        text: `${tenantName} has shared project access with you on Sealayer.\n\nProjects: ${projectNames}\n\nAccept your invitation: ${inviteUrl}\n\nThis invite expires in 7 days.\nPowered by Sealayer.`,
        html: `
          <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#ffffff;border-radius:12px">
            <div style="text-align:center;margin-bottom:30px">
              <h1 style="color:#3C3489;font-size:26px;margin:0;font-weight:700">Sealayer</h1>
              <p style="color:#7F77DD;font-size:13px;margin-top:4px">Donor Portal</p>
            </div>
            <h2 style="color:#26215C;font-size:20px">You've been invited</h2>
            <p style="color:#26215C;line-height:1.6">
              <strong>${tenantName}</strong> has shared access to the following projects with you on Sealayer:
            </p>
            <div style="background:#F4F3FE;border:1px solid #E8E6FD;border-radius:8px;padding:16px;margin:16px 0">
              <p style="color:#534AB7;font-weight:600;margin:0">${projectNames}</p>
            </div>
            ${message ? `<p style="color:#26215C;line-height:1.6;font-style:italic">"${message}"</p>` : ''}
            <div style="text-align:center;margin:30px 0">
              <a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;background-color:#3C3489;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">
                Accept Invitation
              </a>
            </div>
            <p style="color:#7F77DD;font-size:13px;text-align:center">This invite expires in 7 days.</p>
            <hr style="border:none;border-top:1px solid #E8E6FD;margin:24px 0"/>
            <p style="color:#7F77DD;font-size:11px;text-align:center">Powered by Sealayer</p>
          </div>
        `
      })
    } catch (emailErr) {
      console.error('Failed to send donor invite email:', emailErr.message)
    }

    // Store donorOrgName + all projectIds as JSON in inviteType
    try {
      await prisma.donorInvite.update({
        where: { id: invite.id },
        data: { inviteType: JSON.stringify({ type: 'NGO_INVITES_DONOR', donorOrgName, projectIds }) }
      })
    } catch { /* non-critical */ }

    res.json({
      id: invite.id,
      email,
      donorOrgName,
      projectIds,
      status: 'PENDING',
      expiresAt,
    })
  } catch (err) {
    console.error('Donor invite error:', err)
    res.status(500).json({ error: 'Failed to create invite' })
  }
})

// ── GET /api/donor/invites (NGO JWT) ──────────────────────────
// Returns invites + active donors with project access for this tenant
router.get('/invites', authenticate, tenantScope, async (req, res) => {
  try {
    const tenantId = req.user.tenantId

    // All invites for this tenant
    const invites = await prisma.donorInvite.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { id: true, name: true } } }
    })

    const data = invites.map(inv => {
      let donorOrgName = ''
      let projectIds = []
      try {
        const meta = JSON.parse(inv.inviteType)
        donorOrgName = meta.donorOrgName || ''
        projectIds = meta.projectIds || []
      } catch {
        // legacy invite
      }
      return {
        id: inv.id,
        token: inv.token,
        email: inv.email,
        donorOrgName,
        projectIds,
        projectName: inv.project?.name || null,
        status: inv.status,
        expiresAt: inv.expiresAt,
        sentAt: inv.createdAt,
      }
    })

    // Active donors: DonorMembers who have DonorProjectAccess for this tenant
    const activeDonors = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT m.id as "memberId", m.email, m.name, o.name as "orgName", o.id as "orgId"
       FROM "DonorProjectAccess" a
       JOIN "DonorOrganisation" o ON a."donorOrgId" = o.id
       JOIN "DonorMember" m ON m."donorOrgId" = o.id
       WHERE a."tenantId" = $1`,
      tenantId
    )

    // For each active donor, get their project access
    const donors = []
    for (const d of activeDonors) {
      const access = await prisma.$queryRawUnsafe(
        `SELECT a."projectId", a."grantedAt", a."revokedAt", p.name as "projectName"
         FROM "DonorProjectAccess" a
         JOIN "Project" p ON a."projectId" = p.id
         WHERE a."donorOrgId" = $1 AND a."tenantId" = $2
         ORDER BY a."grantedAt" DESC`,
        d.orgId, tenantId
      )
      donors.push({
        memberId: d.memberId,
        email: d.email,
        name: d.name,
        orgName: d.orgName,
        orgId: d.orgId,
        projects: access.map(a => ({
          projectId: a.projectId,
          projectName: a.projectName,
          grantedAt: a.grantedAt,
          revokedAt: a.revokedAt,
          active: !a.revokedAt,
        }))
      })
    }

    res.json({ data, donors })
  } catch (err) {
    console.error('List donor invites error:', err)
    res.status(500).json({ error: 'Failed to fetch invites' })
  }
})

// ── GET /api/donor/invite/validate/:token (public) ────────────
router.get('/invite/validate/:token', async (req, res) => {
  try {
    const invite = await prisma.donorInvite.findUnique({
      where: { token: req.params.token },
      include: {
        tenant: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } }
      }
    })

    if (!invite) return res.status(404).json({ error: 'Invite not found' })
    if (invite.status !== 'PENDING') return res.status(400).json({ error: 'Invite already used' })
    if (new Date() > invite.expiresAt) return res.status(400).json({ error: 'Invite has expired' })

    // Parse metadata
    let donorOrgName = ''
    let projectIds = []
    let projectNames = []
    try {
      const meta = JSON.parse(invite.inviteType)
      donorOrgName = meta.donorOrgName || ''
      projectIds = meta.projectIds || []
    } catch {
      // fallback
    }

    // Get project names
    if (projectIds.length) {
      const projects = await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true }
      })
      projectNames = projects.map(p => p.name)
    } else if (invite.project) {
      projectNames = [invite.project.name]
      projectIds = [invite.project.id]
    }

    // Check if account already exists
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM "DonorMember" WHERE email = $1`,
      invite.email.toLowerCase().trim()
    )

    res.json({
      email: invite.email,
      donorOrgName,
      tenantName: invite.tenant?.name || 'An organisation',
      tenantId: invite.tenantId,
      projectIds,
      projectNames,
      expiresAt: invite.expiresAt,
      existingAccount: existing.length > 0,
    })
  } catch (err) {
    console.error('Validate invite error:', err)
    res.status(500).json({ error: 'Failed to validate invite' })
  }
})

// ═══════════════════════════════════════════════════════════════
//  FIX 2: Donor access management endpoints (NGO JWT)
// ═══════════════════════════════════════════════════════════════

// ── POST /api/donor/access/add (NGO JWT) ──────────────────────
router.post('/access/add', authenticate, tenantScope, async (req, res) => {
  try {
    const { donorEmail, projectIds } = req.body
    if (!donorEmail || !projectIds?.length) {
      return res.status(400).json({ error: 'donorEmail and projectIds are required' })
    }

    // Find DonorMember by email
    const members = await prisma.$queryRawUnsafe(
      `SELECT m.id, m."donorOrgId", o.name as "orgName"
       FROM "DonorMember" m
       LEFT JOIN "DonorOrganisation" o ON m."donorOrgId" = o.id
       WHERE m.email = $1`,
      donorEmail.toLowerCase().trim()
    )
    if (!members.length) {
      return res.status(404).json({ error: 'Donor has not yet accepted an invite' })
    }

    const member = members[0]
    const tenantId = req.user.tenantId

    // Upsert DonorProjectAccess for each projectId
    for (const projectId of projectIds) {
      if (!projectId) continue
      await prisma.$executeRawUnsafe(
        `INSERT INTO "DonorProjectAccess" ("donorOrgId", "projectId", "tenantId", "grantedBy")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("donorOrgId", "projectId") DO UPDATE SET "revokedAt" = NULL, "grantedAt" = NOW()`,
        member.donorOrgId, projectId, tenantId, req.user.userId
      )
    }

    // Return updated access list
    const access = await prisma.$queryRawUnsafe(
      `SELECT a."projectId", a."grantedAt", a."revokedAt", p.name as "projectName"
       FROM "DonorProjectAccess" a
       JOIN "Project" p ON a."projectId" = p.id
       WHERE a."donorOrgId" = $1 AND a."tenantId" = $2
       ORDER BY a."grantedAt" DESC`,
      member.donorOrgId, tenantId
    )

    res.json({
      donorEmail,
      orgName: member.orgName,
      projects: access.map(a => ({
        projectId: a.projectId,
        projectName: a.projectName,
        grantedAt: a.grantedAt,
        revokedAt: a.revokedAt,
        active: !a.revokedAt,
      }))
    })
  } catch (err) {
    console.error('Add donor access error:', err)
    res.status(500).json({ error: 'Failed to add donor access' })
  }
})

// ── DELETE /api/donor/access/remove (NGO JWT) ─────────────────
router.delete('/access/remove', authenticate, tenantScope, async (req, res) => {
  try {
    const { donorEmail, projectId } = req.body
    if (!donorEmail || !projectId) {
      return res.status(400).json({ error: 'donorEmail and projectId are required' })
    }

    // Find DonorMember
    const members = await prisma.$queryRawUnsafe(
      `SELECT m.id, m."donorOrgId" FROM "DonorMember" m WHERE m.email = $1`,
      donorEmail.toLowerCase().trim()
    )
    if (!members.length) {
      return res.status(404).json({ error: 'Donor not found' })
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "DonorProjectAccess" SET "revokedAt" = NOW()
       WHERE "donorOrgId" = $1 AND "projectId" = $2 AND "tenantId" = $3`,
      members[0].donorOrgId, projectId, req.user.tenantId
    )

    res.json({ success: true })
  } catch (err) {
    console.error('Remove donor access error:', err)
    res.status(500).json({ error: 'Failed to remove donor access' })
  }
})

// ── GET /api/donor/access/:donorEmail (NGO JWT) ───────────────
router.get('/access/:donorEmail', authenticate, tenantScope, async (req, res) => {
  try {
    const donorEmail = decodeURIComponent(req.params.donorEmail).toLowerCase().trim()

    // Find DonorMember
    const members = await prisma.$queryRawUnsafe(
      `SELECT m.id, m."donorOrgId", m.name, o.name as "orgName"
       FROM "DonorMember" m
       LEFT JOIN "DonorOrganisation" o ON m."donorOrgId" = o.id
       WHERE m.email = $1`,
      donorEmail
    )
    if (!members.length) {
      return res.status(404).json({ error: 'Donor not found' })
    }

    const member = members[0]
    const access = await prisma.$queryRawUnsafe(
      `SELECT a."projectId", a."grantedAt", a."revokedAt", p.name as "projectName"
       FROM "DonorProjectAccess" a
       JOIN "Project" p ON a."projectId" = p.id
       WHERE a."donorOrgId" = $1 AND a."tenantId" = $2
       ORDER BY a."grantedAt" DESC`,
      member.donorOrgId, req.user.tenantId
    )

    res.json({
      email: donorEmail,
      name: member.name,
      orgName: member.orgName,
      projects: access.map(a => ({
        projectId: a.projectId,
        projectName: a.projectName,
        grantedAt: a.grantedAt,
        revokedAt: a.revokedAt,
        active: !a.revokedAt,
      }))
    })
  } catch (err) {
    console.error('Get donor access error:', err)
    res.status(500).json({ error: 'Failed to fetch donor access' })
  }
})

// ── POST /api/donor/invite/resend (NGO JWT) ───────────────────
router.post('/invite/resend', authenticate, tenantScope, async (req, res) => {
  try {
    const { inviteId } = req.body
    if (!inviteId) return res.status(400).json({ error: 'inviteId is required' })

    const oldInvite = await prisma.donorInvite.findUnique({ where: { id: inviteId } })
    if (!oldInvite) return res.status(404).json({ error: 'Invite not found' })
    if (oldInvite.tenantId !== req.user.tenantId) return res.status(403).json({ error: 'Not your invite' })

    // Expire old invite
    await prisma.donorInvite.update({ where: { id: inviteId }, data: { status: 'EXPIRED' } })

    // Create new invite with fresh token
    const newToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const newInvite = await prisma.donorInvite.create({
      data: {
        token: newToken,
        email: oldInvite.email,
        invitedByUserId: req.user.userId,
        inviteType: oldInvite.inviteType,
        tenantId: req.user.tenantId,
        projectId: oldInvite.projectId,
        expiresAt,
      }
    })

    // Parse metadata for email
    let donorOrgName = ''
    let projectIds = []
    try {
      const meta = JSON.parse(oldInvite.inviteType)
      donorOrgName = meta.donorOrgName || ''
      projectIds = meta.projectIds || []
    } catch {}

    const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId }, select: { name: true } })
    const tenantName = tenant?.name || 'An organisation'
    const projects = projectIds.length
      ? await prisma.project.findMany({ where: { id: { in: projectIds } }, select: { name: true } })
      : []
    const projectNames = projects.map(p => p.name).join(', ')
    const inviteUrl = `https://donor.sealayer.io/signup?token=${newToken}`

    try {
      await sendEmail({
        to: oldInvite.email,
        subject: `Reminder: ${tenantName} has shared project access with you on Sealayer`,
        text: `${tenantName} has shared project access with you on Sealayer.\n\nProjects: ${projectNames}\n\nAccept your invitation: ${inviteUrl}\n\nThis invite expires in 7 days.\nPowered by Sealayer.`,
        html: `
          <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#ffffff;border-radius:12px">
            <div style="text-align:center;margin-bottom:30px">
              <h1 style="color:#3C3489;font-size:26px;margin:0;font-weight:700">Sealayer</h1>
              <p style="color:#7F77DD;font-size:13px;margin-top:4px">Donor Portal</p>
            </div>
            <h2 style="color:#26215C;font-size:20px">Reminder: You've been invited</h2>
            <p style="color:#26215C;line-height:1.6">
              <strong>${tenantName}</strong> has shared access to the following projects with you on Sealayer:
            </p>
            <div style="background:#F4F3FE;border:1px solid #E8E6FD;border-radius:8px;padding:16px;margin:16px 0">
              <p style="color:#534AB7;font-weight:600;margin:0">${projectNames}</p>
            </div>
            <div style="text-align:center;margin:30px 0">
              <a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;background-color:#3C3489;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">
                Accept Invitation
              </a>
            </div>
            <p style="color:#7F77DD;font-size:13px;text-align:center">This invite expires in 7 days.</p>
            <hr style="border:none;border-top:1px solid #E8E6FD;margin:24px 0"/>
            <p style="color:#7F77DD;font-size:11px;text-align:center">Powered by Sealayer</p>
          </div>
        `
      })
    } catch (emailErr) {
      console.error('Failed to resend donor invite email:', emailErr.message)
    }

    res.json({ id: newInvite.id, email: oldInvite.email, status: 'PENDING', expiresAt })
  } catch (err) {
    console.error('Resend invite error:', err)
    res.status(500).json({ error: 'Failed to resend invite' })
  }
})

// ── POST /api/donor/invite/cancel (NGO JWT) ───────────────────
router.post('/invite/cancel', authenticate, tenantScope, async (req, res) => {
  try {
    const { inviteId } = req.body
    if (!inviteId) return res.status(400).json({ error: 'inviteId is required' })

    const invite = await prisma.donorInvite.findUnique({ where: { id: inviteId } })
    if (!invite) return res.status(404).json({ error: 'Invite not found' })
    if (invite.tenantId !== req.user.tenantId) return res.status(403).json({ error: 'Not your invite' })
    if (invite.status !== 'PENDING') return res.status(400).json({ error: 'Invite is not pending' })

    await prisma.donorInvite.update({ where: { id: inviteId }, data: { status: 'EXPIRED' } })
    res.json({ success: true })
  } catch (err) {
    console.error('Cancel invite error:', err)
    res.status(500).json({ error: 'Failed to cancel invite' })
  }
})

module.exports = router
