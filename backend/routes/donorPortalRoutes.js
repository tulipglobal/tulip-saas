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
const { createNotification, ensureDefaultPrefs, ALERT_TYPES } = require('../services/donorNotificationService')
const multer = require('multer')
const { uploadToS3, getPresignedUrl } = require('../lib/s3Upload')
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
}).single('file')

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES = '7d'

// Ensure BudgetAlert table exists
;(async () => {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BudgetAlert" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "projectId" TEXT NOT NULL,
        "donorOrgId" TEXT NOT NULL,
        threshold INTEGER NOT NULL,
        "sentAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("projectId", "donorOrgId", threshold)
      )
    `)
  } catch (err) {
    console.error('BudgetAlert table creation skipped:', err.message?.slice(0, 100))
  }
})()

// ── Completion % helper ──────────────────────────────────────
function calcCompletion(project, totalSpent, totalFunded, deliverableStats, milestoneStats) {
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

  // Deliverables % (CONFIRMED / total)
  let deliverablesPct = null
  if (deliverableStats && deliverableStats.total > 0) {
    deliverablesPct = Math.min(Math.max((deliverableStats.confirmed / deliverableStats.total) * 100, 0), 100)
  }

  // Impact milestones % (ACHIEVED / total)
  let impactPct = null
  if (milestoneStats && milestoneStats.total > 0) {
    impactPct = Math.min(Math.max((milestoneStats.achieved / milestoneStats.total) * 100, 0), 100)
  }

  // Combined — average only the components that have data
  const components = []
  if (timePercent !== null) components.push(timePercent)
  if (financialPercent !== null) components.push(financialPercent)
  if (deliverablesPct !== null) components.push(deliverablesPct)
  if (impactPct !== null) components.push(impactPct)

  let completionPercent = 0
  if (components.length > 0) {
    completionPercent = components.reduce((sum, v) => sum + v, 0) / components.length
  }
  completionPercent = Math.min(Math.max(completionPercent, 0), 100)

  return {
    timePercent: timePercent !== null ? Math.round(timePercent * 10) / 10 : null,
    financialPercent: financialPercent !== null ? Math.round(financialPercent * 10) / 10 : null,
    deliverablesPct: deliverablesPct !== null ? Math.round(deliverablesPct * 10) / 10 : null,
    impactPct: impactPct !== null ? Math.round(impactPct * 10) / 10 : null,
    completionPercent: Math.round(completionPercent * 10) / 10,
    isOverdue,
    isClosed,
    hasEndDate,
    startDate: project.startDate,
    endDate: project.endDate,
  }
}

// ── Trust score helper ────────────────────────────────────────
function calcTrustScore(ngoProjectIds, expenseMap, sealMap, flagMap, allExpenses, allDocuments) {
  // allExpenses: array of { projectId, approvalStatus, fraudRiskLevel, receiptSealId, amountMismatch, vendorMismatch, dateMismatch }
  // allDocuments: array of { projectId } with seal info

  const exps = allExpenses.filter(e => ngoProjectIds.includes(e.projectId))
  const docs = allDocuments.filter(d => ngoProjectIds.includes(d.projectId))
  const totalExp = exps.length
  const totalDocs = docs.length

  const components = []

  // 1. Seal coverage
  if (totalExp > 0) {
    const sealed = exps.filter(e => e.receiptSealId).length
    const score = Math.round((sealed / totalExp) * 100)
    components.push({ name: 'Seal Coverage', score, denominator: totalExp })
  }

  // 2. Fraud block rate (inverse of flagged %)
  if (totalExp > 0) {
    const flagged = exps.filter(e => e.fraudRiskLevel === 'HIGH' || e.fraudRiskLevel === 'CRITICAL').length
    const score = Math.round(100 - ((flagged / totalExp) * 100))
    components.push({ name: 'Fraud Block Rate', score, denominator: totalExp })
  }

  // 3. Low risk rate
  if (totalExp > 0) {
    const low = exps.filter(e => !e.fraudRiskLevel || e.fraudRiskLevel === 'LOW').length
    const score = Math.round((low / totalExp) * 100)
    components.push({ name: 'Low Risk Rate', score, denominator: totalExp })
  }

  // 4. Approval compliance
  if (totalExp > 0) {
    const approved = exps.filter(e => e.approvalStatus === 'APPROVED' || e.approvalStatus === 'AUTO_APPROVED').length
    const score = Math.round((approved / totalExp) * 100)
    components.push({ name: 'Approval Compliance', score, denominator: totalExp })
  }

  // 5. OCR match rate
  if (totalExp > 0) {
    const clean = exps.filter(e => !e.amountMismatch && !e.vendorMismatch && !e.dateMismatch).length
    const score = Math.round((clean / totalExp) * 100)
    components.push({ name: 'OCR Match Rate', score, denominator: totalExp })
  }

  // 6. Document coverage (sealed docs)
  if (totalDocs > 0) {
    const sealedDocs = docs.filter(d => d.sealId).length
    const score = Math.round((sealedDocs / totalDocs) * 100)
    components.push({ name: 'Document Coverage', score, denominator: totalDocs })
  }

  if (components.length === 0) {
    return { trustScore: null, trustGrade: null, trustComponents: [] }
  }

  const trustScore = Math.round(components.reduce((s, c) => s + c.score, 0) / components.length)
  let trustGrade = 'Poor'
  if (trustScore >= 90) trustGrade = 'Excellent'
  else if (trustScore >= 70) trustGrade = 'Good'
  else if (trustScore >= 50) trustGrade = 'Fair'

  return { trustScore, trustGrade, trustComponents: components }
}

// ── Budget threshold alert helper ────────────────────────────
async function checkBudgetAlerts(projectId, totalBudget, totalSpent) {
  if (!totalBudget || totalBudget <= 0) return

  const utilisation = (totalSpent / totalBudget) * 100
  const thresholds = [70, 80, 90, 100]

  for (const threshold of thresholds) {
    if (utilisation < threshold) continue

    // Check if alert already sent
    try {
      const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM "BudgetAlert" WHERE "projectId" = $1 AND threshold = $2`,
        projectId, threshold
      )
      if (existing.length > 0) continue

      // Get project details
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, tenantId: true }
      })
      if (!project) continue

      // Get all donor orgs with access to this project
      const donorAccess = await prisma.$queryRawUnsafe(
        `SELECT DISTINCT a."donorOrgId"
         FROM "DonorProjectAccess" a
         WHERE a."projectId" = $1 AND a."revokedAt" IS NULL`,
        projectId
      )

      for (const access of donorAccess) {
        // Get member emails
        const members = await prisma.$queryRawUnsafe(
          `SELECT email FROM "DonorMember" WHERE "donorOrgId" = $1`,
          access.donorOrgId
        )

        const remaining = totalBudget - totalSpent
        const levelLabel = threshold >= 100 ? 'Fully Utilised' : threshold >= 90 ? 'Urgent' : threshold >= 80 ? 'Warning' : 'Informational'

        for (const member of members) {
          try {
            await sendEmail({
              to: member.email,
              subject: `Budget Alert — ${project.name} is ${Math.round(utilisation)}% utilised`,
              text: `${project.name} has now utilised ${Math.round(utilisation)}% of its total budget.\n\nTotal budget: $${totalBudget.toLocaleString()}\nTotal spent: $${totalSpent.toLocaleString()}\nRemaining: $${remaining.toLocaleString()}\n\nView project: https://donor.sealayer.io/projects/${projectId}\n\nThis is an automated alert from Sealayer.io`,
              html: `
                <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#ffffff;border-radius:12px">
                  <h1 style="color:#3C3489;text-align:center;font-size:26px">Sealayer</h1>
                  <h2 style="color:#26215C;font-size:18px">Budget Alert — ${levelLabel}</h2>
                  <p style="color:#26215C"><strong>${project.name}</strong> has now utilised <strong>${Math.round(utilisation)}%</strong> of its total budget.</p>
                  <div style="background:#F4F3FE;border:1px solid #E8E6FD;border-radius:8px;padding:16px;margin:16px 0">
                    <p style="margin:4px 0;color:#26215C">Total budget: <strong>$${totalBudget.toLocaleString()}</strong></p>
                    <p style="margin:4px 0;color:#26215C">Total spent: <strong>$${totalSpent.toLocaleString()}</strong></p>
                    <p style="margin:4px 0;color:${remaining < 0 ? '#DC2626' : '#26215C'}">Remaining: <strong>$${remaining.toLocaleString()}</strong></p>
                  </div>
                  <div style="text-align:center;margin:24px 0">
                    <a href="https://donor.sealayer.io/projects/${projectId}" style="display:inline-block;padding:12px 28px;background:#3C3489;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">View Project</a>
                  </div>
                  <p style="color:#7F77DD;font-size:11px;text-align:center">This is an automated alert from Sealayer.io</p>
                </div>
              `
            })
          } catch (emailErr) {
            console.error(`Budget alert email failed for ${member.email}:`, emailErr.message)
          }
        }

        // In-app notification via donor notification service
        const alertType = `budget.threshold_${threshold}`
        createNotification({
          donorOrgId: access.donorOrgId,
          alertType,
          title: `${project.name} is ${Math.round(utilisation)}% utilised`,
          body: `${project.name} has utilised ${Math.round(utilisation)}% of its total budget ($${totalBudget.toLocaleString()} budget, $${totalSpent.toLocaleString()} spent, $${remaining.toLocaleString()} remaining).`,
          entityType: 'project',
          entityId: projectId,
          projectId,
        }).catch(err => console.error('Budget notification error:', err.message))

        // Record alert sent
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "BudgetAlert" ("projectId", "donorOrgId", threshold)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            projectId, access.donorOrgId, threshold
          )
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error(`Budget alert check failed for threshold ${threshold}:`, err.message)
    }
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

    // Get real funding totals from FundingAgreement via ProjectFunding (filtered by donor org)
    let fundingMap = {}
    try {
      const fundingTotals = await prisma.$queryRawUnsafe(
        `SELECT pf."projectId", COALESCE(SUM(pf."allocatedAmount"), 0)::float as "totalFunded"
         FROM "ProjectFunding" pf
         JOIN "FundingAgreement" fa ON fa.id = pf."fundingAgreementId"
         WHERE pf."projectId" = ANY($1::text[])
           AND fa."donorOrgId" = $2
           AND fa."funderType" = 'PORTAL'
         GROUP BY pf."projectId"`,
        projectIds,
        donorOrgId
      )
      for (const ft of fundingTotals) fundingMap[ft.projectId] = ft.totalFunded
    } catch { /* ProjectFunding may not exist */ }

    // Get all expenses for trust score calculation
    let allExpensesForTrust = []
    try {
      allExpensesForTrust = await prisma.expense.findMany({
        where: { projectId: { in: projectIds } },
        select: { projectId: true, approvalStatus: true, fraudRiskLevel: true, receiptSealId: true, amountMismatch: true, vendorMismatch: true, dateMismatch: true }
      })
    } catch { /* may fail */ }

    // Get all documents for trust score
    let allDocsForTrust = []
    try {
      allDocsForTrust = await prisma.$queryRawUnsafe(
        `SELECT d.id, d."projectId", ts.id as "sealId"
         FROM "Document" d
         LEFT JOIN "TrustSeal" ts ON ts."documentId" = d.id
         WHERE d."projectId" = ANY($1::text[])`,
        projectIds
      )
    } catch {
      try {
        allDocsForTrust = await prisma.document.findMany({
          where: { projectId: { in: projectIds } },
          select: { id: true, projectId: true }
        })
      } catch { /* may fail */ }
    }

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
      // Fetch deliverable + milestone stats for completion calc
      let deliverableStats = null
      let milestoneStats = null
      try {
        const drCounts = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int as total, COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END)::int as confirmed FROM "DeliverableRequest" WHERE "projectId" = $1`, p.id
        )
        if (drCounts[0]?.total > 0) deliverableStats = drCounts[0]
      } catch {}
      try {
        const imCounts = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int as total, COUNT(CASE WHEN status = 'ACHIEVED' THEN 1 END)::int as achieved FROM "ImpactMilestone" WHERE "projectId" = $1`, p.id
        )
        if (imCounts[0]?.total > 0) milestoneStats = imCounts[0]
      } catch {}
      const completion = calcCompletion(p, spent, realFunded, deliverableStats, milestoneStats)
      ngoMap[p.tenantId].projects.push({
        id: p.id,
        name: p.name,
        description: p.description,
        budget: realBudget,
        funded: realFunded,
        hasFunding: realFunded > 0,
        status: p.status,
        expenseCount: expenseMap[p.id]?.count || 0,
        spent,
        sealCount: sealMap[p.id] || 0,
        flagCount: flagMap[p.id] || 0,
        documentCount: p._count.documents,
        ...completion,
      })
    }

    // Calculate NGO completion averages + trust scores
    const ngoList = Object.values(ngoMap)
    for (const ngo of ngoList) {
      const active = ngo.projects.filter(p => !p.isClosed)
      if (active.length > 0) {
        ngo.ngoCompletionPercent = Math.round((active.reduce((s, p) => s + p.completionPercent, 0) / active.length) * 10) / 10
      } else {
        ngo.ngoCompletionPercent = 0
      }
      // Trust score
      const ngoProjectIds = ngo.projects.map(p => p.id)
      const trust = calcTrustScore(ngoProjectIds, expenseMap, sealMap, flagMap, allExpensesForTrust, allDocsForTrust)
      ngo.trustScore = trust.trustScore
      ngo.trustGrade = trust.trustGrade
      ngo.trustComponents = trust.trustComponents
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

    // Get real funding total from ProjectFunding table (filtered by donor org)
    let totalFunded = 0
    try {
      const fundingResult = await prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(pf."allocatedAmount"), 0)::float as "totalFunded"
         FROM "ProjectFunding" pf
         JOIN "FundingAgreement" fa ON fa.id = pf."fundingAgreementId"
         WHERE pf."projectId" = $1
           AND fa."donorOrgId" = $2
           AND fa."funderType" = 'PORTAL'`,
        projectId,
        donorOrgId
      )
      totalFunded = fundingResult[0]?.totalFunded || 0
    } catch { /* ProjectFunding may not exist */ }

    // Get funding sources from FundingAgreement via ProjectFunding (this donor only)
    let fundingSources = []
    try {
      fundingSources = await prisma.$queryRawUnsafe(
        `SELECT fa.id, fa."funderName" as name, pf."allocatedAmount" as amount,
                fa.currency, fa."agreementType" as type
         FROM "ProjectFunding" pf
         JOIN "FundingAgreement" fa ON fa.id = pf."fundingAgreementId"
         WHERE pf."projectId" = $1
           AND fa."donorOrgId" = $2`,
        projectId,
        donorOrgId
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

    // Fetch deliverable + milestone stats for completion calc
    let deliverableStats = null
    let milestoneStats = null
    try {
      const drCounts = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as total, COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END)::int as confirmed FROM "DeliverableRequest" WHERE "projectId" = $1`, projectId
      )
      if (drCounts[0]?.total > 0) deliverableStats = drCounts[0]
    } catch {}
    try {
      const imCounts = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as total, COUNT(CASE WHEN status = 'ACHIEVED' THEN 1 END)::int as achieved FROM "ImpactMilestone" WHERE "projectId" = $1`, projectId
      )
      if (imCounts[0]?.total > 0) milestoneStats = imCounts[0]
    } catch {}
    const completion = calcCompletion(project, totalSpent, totalFunded, deliverableStats, milestoneStats)

    // Duplicate document hash detection
    let duplicateGroups = []
    try {
      const dupes = await prisma.$queryRawUnsafe(
        `SELECT e.id, e.description as vendor, e.amount, e.currency,
                COALESCE(e."ocrDate", e."createdAt") as "expenseDate",
                ts."rawHash" as hash, ts."anchoredAt", ts.status as "sealStatus"
         FROM "Expense" e
         JOIN "TrustSeal" ts ON ts."expenseId" = e.id
         WHERE e."projectId" = $1
           AND e."approvalStatus" IN ('APPROVED', 'AUTO_APPROVED')
           AND ts."rawHash" IN (
             SELECT ts2."rawHash" FROM "TrustSeal" ts2
             JOIN "Expense" e2 ON ts2."expenseId" = e2.id
             WHERE e2."projectId" = $1 AND ts2."rawHash" IS NOT NULL
             GROUP BY ts2."rawHash" HAVING COUNT(*) > 1
           )
         ORDER BY ts."rawHash", e."createdAt"`,
        projectId
      )
      // Group by hash
      const groupMap = {}
      for (const d of dupes) {
        if (!groupMap[d.hash]) groupMap[d.hash] = { hash: d.hash, expenses: [] }
        groupMap[d.hash].expenses.push({
          id: d.id, vendor: d.vendor, amount: Number(d.amount), currency: d.currency,
          date: d.expenseDate, sealStatus: d.sealStatus, anchoredAt: d.anchoredAt
        })
      }
      duplicateGroups = Object.values(groupMap)
    } catch { /* TrustSeal may not have expenseId */ }

    // Get tenant name for breadcrumb
    let tenantName = ''
    try {
      const t = await prisma.tenant.findUnique({ where: { id: project.tenantId }, select: { name: true } })
      tenantName = t?.name || ''
    } catch { /* may fail */ }

    res.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        budget: totalBudget,
        funded: totalFunded,
        hasFunding: totalFunded > 0,
        spent: totalSpent,
        remaining: totalBudget - totalSpent,
        tenantName,
        ...completion,
      },
      fundingSources,
      expenses,
      duplicateGroups,
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

    // Monthly spend for last 6 months — always return all 6 months
    let monthlySpend = []
    try {
      const now = new Date()
      const months = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push(d.toISOString().slice(0, 7)) // YYYY-MM
      }

      const rawSpend = await prisma.$queryRawUnsafe(
        `SELECT TO_CHAR(DATE_TRUNC('month', e."createdAt"), 'YYYY-MM') as month,
                SUM(e.amount)::float as spent
         FROM "Expense" e
         WHERE e."projectId" = $1
           AND e."approvalStatus" IN ('APPROVED', 'AUTO_APPROVED')
           AND e."createdAt" >= $2::timestamp
         GROUP BY DATE_TRUNC('month', e."createdAt")
         ORDER BY DATE_TRUNC('month', e."createdAt")`,
        projectId, new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()
      )

      const spendMap = {}
      for (const r of rawSpend) spendMap[r.month] = r.spent

      monthlySpend = months.map(m => ({ month: m, spent: spendMap[m] || 0 }))
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

    // Trigger budget threshold alerts (non-blocking)
    checkBudgetAlerts(projectId, totalBudget, totalSpent).catch(err =>
      console.error('Budget alert check error:', err.message)
    )

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

// ── GET /api/donor/projects/:projectId/trust-history ──────────
router.get('/projects/:projectId/trust-history', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor
    const { projectId } = req.params

    // Verify access
    const access = await prisma.$queryRawUnsafe(
      `SELECT id, "tenantId" FROM "DonorProjectAccess"
       WHERE "donorOrgId" = $1 AND "projectId" = $2 AND "revokedAt" IS NULL`,
      donorOrgId, projectId
    )
    if (!access.length) return res.status(403).json({ error: 'No access' })

    const now = new Date()
    const history = {
      sealCoverage: [],
      fraudBlockRate: [],
      lowRiskRate: [],
      approvalCompliance: [],
      ocrMatchRate: [],
      documentCoverage: [],
    }

    // Calculate for each of the last 8 weeks (ending Sunday)
    for (let w = 7; w >= 0; w--) {
      const weekEnd = new Date(now)
      weekEnd.setDate(weekEnd.getDate() - (w * 7))
      const weekEndStr = weekEnd.toISOString()

      // Get expenses up to this week
      let exps = []
      try {
        exps = await prisma.$queryRawUnsafe(
          `SELECT "approvalStatus", "fraudRiskLevel", "receiptSealId",
                  "amountMismatch", "vendorMismatch", "dateMismatch"
           FROM "Expense"
           WHERE "projectId" = $1 AND "createdAt" <= $2::timestamp`,
          projectId, weekEndStr
        )
      } catch { /* may fail */ }

      const total = exps.length
      if (total === 0) {
        history.sealCoverage.push(0)
        history.fraudBlockRate.push(100)
        history.lowRiskRate.push(100)
        history.approvalCompliance.push(100)
        history.ocrMatchRate.push(100)
        history.documentCoverage.push(0)
        continue
      }

      const sealed = exps.filter(e => e.receiptSealId).length
      history.sealCoverage.push(Math.round((sealed / total) * 100))

      const flagged = exps.filter(e => e.fraudRiskLevel === 'HIGH' || e.fraudRiskLevel === 'CRITICAL').length
      history.fraudBlockRate.push(Math.round(100 - ((flagged / total) * 100)))

      const low = exps.filter(e => !e.fraudRiskLevel || e.fraudRiskLevel === 'LOW').length
      history.lowRiskRate.push(Math.round((low / total) * 100))

      const approved = exps.filter(e => e.approvalStatus === 'APPROVED' || e.approvalStatus === 'AUTO_APPROVED').length
      history.approvalCompliance.push(Math.round((approved / total) * 100))

      const clean = exps.filter(e => !e.amountMismatch && !e.vendorMismatch && !e.dateMismatch).length
      history.ocrMatchRate.push(Math.round((clean / total) * 100))

      // Document coverage — need docs count
      let docTotal = 0, docSealed = 0
      try {
        const docResult = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int as total,
                  COUNT(CASE WHEN ts.id IS NOT NULL THEN 1 END)::int as sealed
           FROM "Document" d
           LEFT JOIN "TrustSeal" ts ON ts."documentId" = d.id
           WHERE d."projectId" = $1 AND d."createdAt" <= $2::timestamp`,
          projectId, weekEndStr
        )
        docTotal = docResult[0]?.total || 0
        docSealed = docResult[0]?.sealed || 0
      } catch { /* may fail */ }
      history.documentCoverage.push(docTotal > 0 ? Math.round((docSealed / docTotal) * 100) : 0)
    }

    res.json({ trustHistory: history })
  } catch (err) {
    console.error('Trust history error:', err)
    res.status(500).json({ error: 'Failed to fetch trust history' })
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
      } else if (log.action === 'EXPENSE_MISMATCH_FLAGGED') {
        icon = 'fraud'
        description = `Mismatch flagged: ${expense?.vendor || expense?.description || 'Unknown'} — ${expense?.currency || '$'} ${(expense?.amount || 0).toLocaleString()}`
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
        expenseId: log.entityType === 'Expense' ? log.entityId : null,
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

// ── GET /api/donor/organisations (NGO JWT) — list donor orgs with access ──
router.get('/organisations', authenticate, tenantScope, async (req, res) => {
  try {
    const orgs = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT o.id, o.name, o.type, o.country, o.website
       FROM "DonorOrganisation" o
       JOIN "DonorProjectAccess" a ON a."donorOrgId" = o.id
       WHERE a."tenantId" = $1 AND a."revokedAt" IS NULL
       ORDER BY o.name`,
      req.user.tenantId
    )
    res.json({ data: orgs })
  } catch (err) {
    console.error('List donor organisations error:', err)
    res.status(500).json({ error: 'Failed to fetch donor organisations' })
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

// ── POST /api/donor/reports/generate-monthly ─────────────────
router.post('/reports/generate-monthly', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor
    const { month } = req.body // optional, e.g. "2026-02"

    const { generateMonthlyReport } = require('../jobs/monthlyReport')
    const result = await generateMonthlyReport(donorOrgId, month)
    if (!result) return res.status(404).json({ error: 'No projects found' })

    // Get member emails
    const members = await prisma.$queryRawUnsafe(
      `SELECT email FROM "DonorMember" WHERE "donorOrgId" = $1`, donorOrgId
    )

    let emailsSent = 0
    for (const member of members) {
      try {
        await sendEmail({
          to: member.email,
          subject: `Your Sealayer Monthly Report — ${result.monthLabel}`,
          text: `Please find your monthly project report attached.`,
          html: `
            <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:560px;margin:0 auto;padding:30px">
              <h1 style="color:#3C3489;text-align:center">Sealayer</h1>
              <h2 style="color:#26215C">Monthly Report — ${result.monthLabel}</h2>
              <p style="color:#26215C">Please find your monthly project report attached.</p>
              <p style="color:#7F77DD;font-size:12px">Powered by Sealayer.io</p>
            </div>
          `,
          attachments: [{
            filename: `sealayer-report-${month || 'latest'}.pdf`,
            content: result.pdfBuffer,
            contentType: 'application/pdf'
          }]
        })
        emailsSent++
      } catch (emailErr) {
        console.error(`Failed to send report to ${member.email}:`, emailErr.message)
      }
    }

    res.json({ success: true, emailsSent })
  } catch (err) {
    console.error('Generate monthly report error:', err)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

// ── Donor Challenge Routes ──────────────────────────────────

// POST /api/donor/expenses/:expenseId/challenge — Create a challenge
router.post('/expenses/:expenseId/challenge', donorAuth, async (req, res) => {
  try {
    const { donorOrgId, donorMemberId } = req.donor
    const { expenseId } = req.params
    const { note } = req.body
    if (!note || note.length > 500) return res.status(400).json({ error: 'Note is required (max 500 chars)' })

    // Verify expense exists and donor has access
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: { id: true, projectId: true, approvalStatus: true, description: true, vendor: true, amount: true, currency: true, ocrDate: true, createdAt: true }
    })
    if (!expense) return res.status(404).json({ error: 'Expense not found' })

    // Check donor has access to this project
    const access = await prisma.$queryRawUnsafe(
      `SELECT id FROM "DonorProjectAccess" WHERE "donorOrgId" = $1 AND "projectId" = $2 AND "revokedAt" IS NULL`,
      donorOrgId, expense.projectId
    )
    if (!access.length) return res.status(403).json({ error: 'No access to this project' })

    // Check expense is approved (case-insensitive, also allow sealed/anchored)
    const status = (expense.approvalStatus || '').toUpperCase()
    if (!['APPROVED', 'AUTO_APPROVED'].includes(status)) {
      return res.status(400).json({ error: `Can only challenge approved expenses (current status: ${expense.approvalStatus})` })
    }

    // Check no existing active challenge from this donor org
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM "ExpenseChallenge" WHERE "expenseId" = $1 AND "donorOrgId" = $2 AND status IN ('OPEN', 'ESCALATED')`,
      expenseId, donorOrgId
    )
    if (existing.length) return res.status(409).json({ error: 'An active challenge already exists for this expense' })

    // Create challenge
    const challenge = await prisma.$queryRawUnsafe(
      `INSERT INTO "ExpenseChallenge" ("expenseId", "projectId", "donorOrgId", "donorMemberId", note, status)
       VALUES ($1, $2, $3, $4, $5, 'OPEN') RETURNING *`,
      expenseId, expense.projectId, donorOrgId, donorMemberId, note
    )

    // Send email to NGO admins (non-blocking)
    ;(async () => {
      try {
        const project = await prisma.project.findUnique({ where: { id: expense.projectId }, select: { name: true, tenantId: true } })
        if (!project) return
        const donorOrg = await prisma.$queryRawUnsafe(`SELECT name FROM "DonorOrganisation" WHERE id = $1`, donorOrgId)
        const donorOrgName = donorOrg[0]?.name || 'A donor'
        const admins = await prisma.user.findMany({
          where: { tenantId: project.tenantId, role: { name: { in: ['Admin', 'Manager', 'admin', 'manager'] } } },
          select: { email: true }
        })
        // Fallback: get all users for tenant if role query fails
        const recipients = admins.length ? admins : await prisma.user.findMany({
          where: { tenantId: project.tenantId },
          select: { email: true },
          take: 5
        })
        const vendor = expense.vendor || expense.description || 'Unknown'
        const amount = `${expense.currency || 'USD'} ${(expense.amount || 0).toLocaleString()}`
        for (const admin of recipients) {
          await sendEmail({
            to: admin.email,
            subject: `Donor Flag — ${vendor} on ${project.name}`,
            text: `${donorOrgName} has flagged an expense for review.\n\nProject: ${project.name}\nExpense: ${vendor} — ${amount}\nDonor note: ${note}\n\nPlease log in to respond: https://app.sealayer.io/dashboard/donor-flags\n\nThis flag does not freeze or void the expense.`,
            html: `
              <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#ffffff;border-radius:12px">
                <h1 style="color:#183a1d;font-size:22px">Donor Flag</h1>
                <p style="color:#183a1d"><strong>${donorOrgName}</strong> has flagged an expense for review.</p>
                <div style="background:#fefbe9;border:1px solid #c8d6c0;border-radius:8px;padding:16px;margin:16px 0">
                  <p style="margin:4px 0;color:#183a1d"><strong>Project:</strong> ${project.name}</p>
                  <p style="margin:4px 0;color:#183a1d"><strong>Expense:</strong> ${vendor} — ${amount}</p>
                  <p style="margin:4px 0;color:#183a1d"><strong>Donor note:</strong> ${note}</p>
                </div>
                <p style="color:#183a1d;font-size:13px">This flag does not freeze or void the expense.</p>
                <div style="text-align:center;margin:24px 0">
                  <a href="https://app.sealayer.io/dashboard/donor-flags" style="display:inline-block;padding:12px 28px;background:#f6c453;color:#183a1d;text-decoration:none;border-radius:8px;font-weight:600">Respond to Flag</a>
                </div>
              </div>`
          }).catch(() => {})
        }
      } catch (err) { console.error('Challenge email error:', err.message) }
    })()

    res.json({ challenge: challenge[0] })
  } catch (err) {
    console.error('Create challenge error:', err)
    res.status(500).json({ error: 'Failed to create challenge' })
  }
})

// GET /api/donor/expenses/:expenseId/challenges — Get challenges for an expense
router.get('/expenses/:expenseId/challenges', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor
    const { expenseId } = req.params

    const challenges = await prisma.$queryRawUnsafe(
      `SELECT * FROM "ExpenseChallenge" WHERE "expenseId" = $1 AND "donorOrgId" = $2 ORDER BY "createdAt" DESC`,
      expenseId, donorOrgId
    )

    // Get responses for each challenge
    for (const c of challenges) {
      const responses = await prisma.$queryRawUnsafe(
        `SELECT * FROM "ExpenseChallengeResponse" WHERE "challengeId" = $1 ORDER BY "createdAt" ASC`,
        c.id
      )
      c.responses = responses
    }

    res.json({ challenges })
  } catch (err) {
    console.error('Get challenges error:', err)
    res.status(500).json({ error: 'Failed to fetch challenges' })
  }
})

// POST /api/donor/challenges/:challengeId/respond — Donor responds to NGO response
router.post('/challenges/:challengeId/respond', donorAuth, async (req, res) => {
  try {
    const { donorOrgId, donorMemberId } = req.donor
    const { challengeId } = req.params
    const { action, note } = req.body
    if (!action || !['CONFIRM', 'ESCALATE'].includes(action)) return res.status(400).json({ error: 'action must be CONFIRM or ESCALATE' })
    if (!note || note.length > 500) return res.status(400).json({ error: 'Note is required (max 500 chars)' })

    // Verify challenge belongs to this donor org and is RESPONDED
    const challenges = await prisma.$queryRawUnsafe(
      `SELECT * FROM "ExpenseChallenge" WHERE id = $1 AND "donorOrgId" = $2`,
      challengeId, donorOrgId
    )
    if (!challenges.length) return res.status(404).json({ error: 'Challenge not found' })
    if (challenges[0].status !== 'RESPONDED') return res.status(400).json({ error: 'Can only respond after NGO has responded' })

    const newStatus = action === 'CONFIRM' ? 'CONFIRMED' : 'ESCALATED'

    // Create response
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ExpenseChallengeResponse" ("challengeId", "respondedBy", "respondedByType", note, action)
       VALUES ($1, $2, 'DONOR', $3, $4)`,
      challengeId, donorMemberId, note, action
    )

    // Update challenge status
    await prisma.$executeRawUnsafe(
      `UPDATE "ExpenseChallenge" SET status = $1, "updatedAt" = NOW() WHERE id = $2`,
      newStatus, challengeId
    )

    // Get updated challenge with responses
    const updated = await prisma.$queryRawUnsafe(`SELECT * FROM "ExpenseChallenge" WHERE id = $1`, challengeId)
    const responses = await prisma.$queryRawUnsafe(
      `SELECT * FROM "ExpenseChallengeResponse" WHERE "challengeId" = $1 ORDER BY "createdAt" ASC`, challengeId
    )
    updated[0].responses = responses

    // Send email to NGO (non-blocking)
    ;(async () => {
      try {
        const challenge = challenges[0]
        const expense = await prisma.expense.findUnique({ where: { id: challenge.expenseId }, select: { vendor: true, description: true, amount: true, currency: true } })
        const project = await prisma.project.findUnique({ where: { id: challenge.projectId }, select: { name: true, tenantId: true } })
        const donorOrg = await prisma.$queryRawUnsafe(`SELECT name FROM "DonorOrganisation" WHERE id = $1`, donorOrgId)
        const donorOrgName = donorOrg[0]?.name || 'A donor'
        const vendor = expense?.vendor || expense?.description || 'Unknown'
        const amount = `${expense?.currency || 'USD'} ${(expense?.amount || 0).toLocaleString()}`

        if (!project) return
        const recipients = await prisma.user.findMany({ where: { tenantId: project.tenantId }, select: { email: true }, take: 5 })

        if (action === 'CONFIRM') {
          for (const r of recipients) {
            await sendEmail({
              to: r.email,
              subject: `Donor Flag Resolved — ${vendor}`,
              text: `${donorOrgName} has confirmed they are satisfied with your response on ${vendor} — ${amount}. The flag has been closed.`,
              html: `<div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#fff;border-radius:12px"><h1 style="color:#183a1d">Donor Flag Resolved</h1><p style="color:#183a1d"><strong>${donorOrgName}</strong> has confirmed they are satisfied with your response on <strong>${vendor} — ${amount}</strong>.</p><p style="color:#2E7D32;font-weight:bold">The flag has been closed. &#10003;</p></div>`
            }).catch(() => {})
          }
        } else {
          for (const r of recipients) {
            await sendEmail({
              to: r.email,
              subject: `Donor Re-flagged — ${vendor} on ${project.name}`,
              text: `${donorOrgName} is not satisfied with your response and has re-flagged this expense.\n\nDonor note: ${note}\n\nPlease respond again: https://app.sealayer.io/dashboard/donor-flags`,
              html: `<div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#fff;border-radius:12px"><h1 style="color:#C62828">Donor Re-flagged</h1><p style="color:#183a1d"><strong>${donorOrgName}</strong> is not satisfied and has re-flagged <strong>${vendor} — ${amount}</strong>.</p><div style="background:#FFEBEE;border-radius:8px;padding:16px;margin:16px 0"><p style="color:#C62828;margin:0"><strong>Donor note:</strong> ${note}</p></div><div style="text-align:center;margin:24px 0"><a href="https://app.sealayer.io/dashboard/donor-flags" style="display:inline-block;padding:12px 28px;background:#f6c453;color:#183a1d;text-decoration:none;border-radius:8px;font-weight:600">Respond Again</a></div></div>`
            }).catch(() => {})
          }
        }
      } catch (err) { console.error('Challenge response email error:', err.message) }
    })()

    res.json({ challenge: updated[0] })
  } catch (err) {
    console.error('Donor challenge respond error:', err)
    res.status(500).json({ error: 'Failed to respond to challenge' })
  }
})

// GET /api/donor/challenges — Get all challenges for this donor org
router.get('/challenges', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor
    const statusFilter = req.query.status

    let query = `SELECT c.* FROM "ExpenseChallenge" c WHERE c."donorOrgId" = $1`
    const params = [donorOrgId]
    if (statusFilter) {
      query += ` AND c.status = $2`
      params.push(statusFilter)
    }
    query += ` ORDER BY c."createdAt" DESC`

    const challenges = await prisma.$queryRawUnsafe(query, ...params)

    // Enrich with expense and project data
    for (const c of challenges) {
      try {
        const expense = await prisma.expense.findUnique({
          where: { id: c.expenseId },
          select: { vendor: true, description: true, amount: true, currency: true, ocrDate: true, createdAt: true }
        })
        c.expense = expense ? {
          vendor: expense.vendor || expense.description, amount: expense.amount,
          currency: expense.currency, expenseDate: expense.ocrDate || expense.createdAt
        } : null
      } catch { c.expense = null }

      try {
        const project = await prisma.project.findUnique({ where: { id: c.projectId }, select: { name: true } })
        c.project = project ? { name: project.name } : null
      } catch { c.project = null }

      const responses = await prisma.$queryRawUnsafe(
        `SELECT * FROM "ExpenseChallengeResponse" WHERE "challengeId" = $1 ORDER BY "createdAt" ASC`, c.id
      )
      c.responses = responses
    }

    res.json({ challenges })
  } catch (err) {
    console.error('Get all challenges error:', err)
    res.status(500).json({ error: 'Failed to fetch challenges' })
  }
})

// ── Notification Routes ──────────────────────────────────────

// GET /api/donor/notifications
router.get('/notifications', donorAuth, async (req, res) => {
  try {
    const { donorMemberId } = req.donor
    const unreadOnly = req.query.unread === 'true'
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const offset = parseInt(req.query.offset) || 0

    let whereClause = `WHERE "donorMemberId" = $1`
    const params = [donorMemberId]
    if (unreadOnly) {
      whereClause += ` AND "isRead" = false`
    }

    const notifications = await prisma.$queryRawUnsafe(
      `SELECT * FROM "DonorNotification" ${whereClause} ORDER BY "createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      ...params, limit, offset
    )

    // Enrich with project name
    for (const n of notifications) {
      if (n.projectId) {
        try {
          const project = await prisma.project.findUnique({ where: { id: n.projectId }, select: { name: true } })
          n.project = project ? { name: project.name } : null
        } catch { n.project = null }
      }
    }

    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM "DonorNotification" WHERE "donorMemberId" = $1`, donorMemberId
    )
    const unreadResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM "DonorNotification" WHERE "donorMemberId" = $1 AND "isRead" = false`, donorMemberId
    )

    res.json({
      notifications,
      unreadCount: unreadResult[0]?.count || 0,
      total: countResult[0]?.total || 0
    })
  } catch (err) {
    console.error('Get notifications error:', err)
    res.status(500).json({ error: 'Failed to fetch notifications' })
  }
})

// GET /api/donor/notifications/unread-count
router.get('/notifications/unread-count', donorAuth, async (req, res) => {
  try {
    const { donorMemberId } = req.donor
    const result = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM "DonorNotification" WHERE "donorMemberId" = $1 AND "isRead" = false`, donorMemberId
    )
    res.json({ count: result[0]?.count || 0 })
  } catch (err) {
    console.error('Unread count error:', err)
    res.status(500).json({ error: 'Failed to fetch count' })
  }
})

// POST /api/donor/notifications/mark-read
router.post('/notifications/mark-read', donorAuth, async (req, res) => {
  try {
    const { donorMemberId } = req.donor
    const { notificationIds, all } = req.body

    let marked = 0
    if (all) {
      const result = await prisma.$queryRawUnsafe(
        `UPDATE "DonorNotification" SET "isRead" = true, "readAt" = NOW() WHERE "donorMemberId" = $1 AND "isRead" = false RETURNING id`, donorMemberId
      )
      marked = result.length
    } else if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
      const placeholders = notificationIds.map((_, i) => `$${i + 2}`).join(', ')
      const result = await prisma.$queryRawUnsafe(
        `UPDATE "DonorNotification" SET "isRead" = true, "readAt" = NOW() WHERE "donorMemberId" = $1 AND id IN (${placeholders}) AND "isRead" = false RETURNING id`,
        donorMemberId, ...notificationIds
      )
      marked = result.length
    }

    res.json({ marked })
  } catch (err) {
    console.error('Mark read error:', err)
    res.status(500).json({ error: 'Failed to mark as read' })
  }
})

// GET /api/donor/notifications/preferences
router.get('/notifications/preferences', donorAuth, async (req, res) => {
  try {
    const { donorMemberId } = req.donor
    await ensureDefaultPrefs(donorMemberId)
    const prefs = await prisma.$queryRawUnsafe(
      `SELECT "alertType", "emailEnabled", "inAppEnabled" FROM "DonorNotificationPref" WHERE "donorMemberId" = $1 ORDER BY "alertType"`, donorMemberId
    )
    res.json({ preferences: prefs })
  } catch (err) {
    console.error('Get preferences error:', err)
    res.status(500).json({ error: 'Failed to fetch preferences' })
  }
})

// PUT /api/donor/notifications/preferences
router.put('/notifications/preferences', donorAuth, async (req, res) => {
  try {
    const { donorMemberId } = req.donor
    const { preferences } = req.body
    if (!Array.isArray(preferences)) return res.status(400).json({ error: 'preferences must be an array' })

    let updated = 0
    for (const pref of preferences) {
      if (!pref.alertType || !ALERT_TYPES[pref.alertType]) continue
      await prisma.$executeRawUnsafe(
        `INSERT INTO "DonorNotificationPref" ("donorMemberId", "alertType", "emailEnabled", "inAppEnabled", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT ("donorMemberId", "alertType") DO UPDATE SET "emailEnabled" = $3, "inAppEnabled" = $4, "updatedAt" = NOW()`,
        donorMemberId, pref.alertType, pref.emailEnabled ?? true, pref.inAppEnabled ?? true
      )
      updated++
    }

    res.json({ updated })
  } catch (err) {
    console.error('Update preferences error:', err)
    res.status(500).json({ error: 'Failed to update preferences' })
  }
})

// ── Sprint 4: Deliverable Request Routes ──────────────────────

// POST /api/donor/upload — Upload a file attachment for deliverable requests
router.post('/upload', donorAuth, uploadMiddleware, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' })
    const { donorOrgId } = req.donor
    const { fileUrl, key } = await uploadToS3(req.file.buffer, req.file.originalname, `donor-${donorOrgId}`, 'deliverable-attachments')
    const viewUrl = await getPresignedUrl(fileUrl)
    res.json({ name: req.file.originalname, url: fileUrl, viewUrl, size: req.file.size })
  } catch (err) {
    console.error('Donor upload error:', err)
    res.status(500).json({ error: 'Upload failed' })
  }
})

// POST /api/donor/projects/:projectId/requests
router.post('/projects/:projectId/requests', donorAuth, async (req, res) => {
  try {
    const { donorOrgId, donorMemberId } = req.donor
    const { projectId } = req.params
    const { title, description, requestType, deadline, attachments } = req.body
    if (!title || !deadline) return res.status(400).json({ error: 'Title and deadline required' })

    // Verify donor access
    const access = await prisma.$queryRawUnsafe(
      `SELECT id FROM "DonorProjectAccess" WHERE "donorOrgId" = $1 AND "projectId" = $2 AND "revokedAt" IS NULL`,
      donorOrgId, projectId
    )
    if (!access.length) return res.status(403).json({ error: 'No access to this project' })

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true, tenantId: true } })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const request = await prisma.$queryRawUnsafe(
      `INSERT INTO "DeliverableRequest" ("projectId", "tenantId", "donorOrgId", "donorMemberId", title, description, "requestType", deadline, attachments)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      projectId, project.tenantId, donorOrgId, donorMemberId, title, description || null, requestType || 'REPORT', new Date(deadline),
      attachments ? JSON.stringify(attachments) : null
    )

    // Email NGO admins (non-blocking)
    const orgs = await prisma.$queryRawUnsafe(`SELECT name FROM "DonorOrganisation" WHERE id = $1`, donorOrgId)
    const orgName = orgs[0]?.name || 'A donor'
    const deadlineFormatted = new Date(deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    ;(async () => {
      try {
        const admins = await prisma.user.findMany({ where: { tenantId: project.tenantId }, select: { email: true } })
        for (const admin of admins.slice(0, 5)) {
          await sendEmail({
            to: admin.email,
            subject: `New Deliverable Request — ${project.name}`,
            text: `${orgName} has raised a new deliverable request on ${project.name}:\n\nTitle: ${title}\nDescription: ${description || '—'}\nDeadline: ${deadlineFormatted}\n\nPlease log in to submit: https://app.sealayer.io`,
            html: `<div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#fff;border-radius:12px"><h1 style="color:#183a1d;font-size:20px">New Deliverable Request</h1><p style="color:#183a1d">${orgName} has raised a new deliverable request on <strong>${project.name}</strong>:</p><div style="background:#fefbe9;border:1px solid #c8d6c0;border-radius:8px;padding:16px;margin:16px 0"><p style="margin:0"><strong>${title}</strong></p>${description ? `<p style="margin:8px 0 0;color:#666">${description}</p>` : ''}<p style="margin:8px 0 0;color:#92400E">Deadline: ${deadlineFormatted}</p></div><div style="text-align:center;margin:24px 0"><a href="https://app.sealayer.io" style="display:inline-block;padding:12px 28px;background:#183a1d;color:#fefbe9;text-decoration:none;border-radius:8px;font-weight:600">Submit Deliverable</a></div></div>`
          }).catch(() => {})
        }
      } catch (err) { console.error('Deliverable request email error:', err.message) }
    })()

    res.json({ request: request[0] })
  } catch (err) {
    console.error('Create deliverable request error:', err)
    res.status(500).json({ error: 'Failed to create request' })
  }
})

// GET /api/donor/projects/:projectId/requests
router.get('/projects/:projectId/requests', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor
    const { projectId } = req.params

    // Verify donor access
    const access = await prisma.$queryRawUnsafe(
      `SELECT id FROM "DonorProjectAccess" WHERE "donorOrgId" = $1 AND "projectId" = $2 AND "revokedAt" IS NULL`,
      donorOrgId, projectId
    )
    if (!access.length) return res.status(403).json({ error: 'No access to this project' })

    const requests = await prisma.$queryRawUnsafe(
      `SELECT dr.*, dorg.name as "donorOrgName"
       FROM "DeliverableRequest" dr
       LEFT JOIN "DonorOrganisation" dorg ON dorg.id = dr."donorOrgId"
       WHERE dr."projectId" = $1 AND dr."donorOrgId" = $2
       ORDER BY dr."createdAt" DESC`,
      projectId, donorOrgId
    )

    // Attach submissions and parse attachments for each request
    for (const req_ of requests) {
      const submissions = await prisma.$queryRawUnsafe(
        `SELECT * FROM "DeliverableSubmission" WHERE "requestId" = $1 ORDER BY "submittedAt" DESC`,
        req_.id
      )
      req_.submissions = submissions
      if (req_.attachments && typeof req_.attachments === 'string') {
        try { req_.attachments = JSON.parse(req_.attachments) } catch { req_.attachments = null }
      }
    }

    res.json({ requests })
  } catch (err) {
    console.error('Get deliverable requests error:', err)
    res.status(500).json({ error: 'Failed to fetch requests' })
  }
})

// POST /api/donor/requests/:requestId/confirm
router.post('/requests/:requestId/confirm', donorAuth, async (req, res) => {
  try {
    const { donorOrgId, donorMemberId } = req.donor
    const { requestId } = req.params

    // Get request and verify ownership
    const requests = await prisma.$queryRawUnsafe(
      `SELECT * FROM "DeliverableRequest" WHERE id = $1 AND "donorOrgId" = $2`,
      requestId, donorOrgId
    )
    if (!requests.length) return res.status(404).json({ error: 'Request not found' })
    const request = requests[0]

    if (!['SUBMITTED', 'RESUBMITTED'].includes(request.status)) {
      return res.status(400).json({ error: 'Request must be in SUBMITTED or RESUBMITTED status to confirm' })
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "DeliverableRequest" SET status = 'CONFIRMED', "updatedAt" = NOW() WHERE id = $1`,
      requestId
    )

    const project = await prisma.project.findUnique({ where: { id: request.projectId }, select: { name: true, tenantId: true } })

    // Email NGO admins (non-blocking)
    ;(async () => {
      try {
        if (!project) return
        const admins = await prisma.user.findMany({ where: { tenantId: project.tenantId }, select: { email: true } })
        const orgs = await prisma.$queryRawUnsafe(`SELECT name FROM "DonorOrganisation" WHERE id = $1`, donorOrgId)
        const orgName = orgs[0]?.name || 'A donor'
        for (const admin of admins.slice(0, 5)) {
          await sendEmail({
            to: admin.email,
            subject: `Deliverable Confirmed — ${project.name}`,
            text: `${orgName} has confirmed the deliverable "${request.title}" on ${project.name}.\n\nNo further action is needed for this request.`,
            html: `<div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#fff;border-radius:12px"><h1 style="color:#183a1d;font-size:20px">Deliverable Confirmed</h1><p style="color:#183a1d">${orgName} has confirmed the deliverable <strong>"${request.title}"</strong> on <strong>${project.name}</strong>.</p><div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:16px;margin:16px 0"><p style="margin:0;color:#065f46">No further action is needed for this request.</p></div></div>`
          }).catch(() => {})
        }
      } catch (err) { console.error('Deliverable confirm email error:', err.message) }
    })()

    const updated = await prisma.$queryRawUnsafe(`SELECT * FROM "DeliverableRequest" WHERE id = $1`, requestId)
    res.json({ request: updated[0] })
  } catch (err) {
    console.error('Confirm deliverable error:', err)
    res.status(500).json({ error: 'Failed to confirm request' })
  }
})

// POST /api/donor/requests/:requestId/rework
router.post('/requests/:requestId/rework', donorAuth, async (req, res) => {
  try {
    const { donorOrgId, donorMemberId } = req.donor
    const { requestId } = req.params
    const { note } = req.body
    if (!note) return res.status(400).json({ error: 'Rework note is required' })

    // Get request and verify ownership
    const requests = await prisma.$queryRawUnsafe(
      `SELECT * FROM "DeliverableRequest" WHERE id = $1 AND "donorOrgId" = $2`,
      requestId, donorOrgId
    )
    if (!requests.length) return res.status(404).json({ error: 'Request not found' })
    const request = requests[0]

    if (!['SUBMITTED', 'RESUBMITTED'].includes(request.status)) {
      return res.status(400).json({ error: 'Request must be in SUBMITTED or RESUBMITTED status to request rework' })
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "DeliverableRequest" SET status = 'REWORK', "reworkNote" = $2, "updatedAt" = NOW() WHERE id = $1`,
      requestId, note
    )

    const project = await prisma.project.findUnique({ where: { id: request.projectId }, select: { name: true, tenantId: true } })

    // Email NGO admins (non-blocking)
    ;(async () => {
      try {
        if (!project) return
        const admins = await prisma.user.findMany({ where: { tenantId: project.tenantId }, select: { email: true } })
        const orgs = await prisma.$queryRawUnsafe(`SELECT name FROM "DonorOrganisation" WHERE id = $1`, donorOrgId)
        const orgName = orgs[0]?.name || 'A donor'
        for (const admin of admins.slice(0, 5)) {
          await sendEmail({
            to: admin.email,
            subject: `Rework Requested — ${project.name}`,
            text: `${orgName} has requested rework on the deliverable "${request.title}" for ${project.name}.\n\nNote: ${note}\n\nPlease log in to resubmit: https://app.sealayer.io`,
            html: `<div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#fff;border-radius:12px"><h1 style="color:#183a1d;font-size:20px">Rework Requested</h1><p style="color:#183a1d">${orgName} has requested rework on <strong>"${request.title}"</strong> for <strong>${project.name}</strong>.</p><div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0"><p style="margin:0;color:#92400E"><strong>Feedback:</strong> ${note}</p></div><div style="text-align:center;margin:24px 0"><a href="https://app.sealayer.io" style="display:inline-block;padding:12px 28px;background:#183a1d;color:#fefbe9;text-decoration:none;border-radius:8px;font-weight:600">Resubmit Deliverable</a></div></div>`
          }).catch(() => {})
        }
      } catch (err) { console.error('Deliverable rework email error:', err.message) }
    })()

    const updated = await prisma.$queryRawUnsafe(`SELECT * FROM "DeliverableRequest" WHERE id = $1`, requestId)
    res.json({ request: updated[0] })
  } catch (err) {
    console.error('Rework deliverable error:', err)
    res.status(500).json({ error: 'Failed to request rework' })
  }
})

// GET /api/donor/projects/:projectId/milestones
router.get('/projects/:projectId/milestones', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor
    const { projectId } = req.params

    // Verify donor access
    const access = await prisma.$queryRawUnsafe(
      `SELECT id FROM "DonorProjectAccess" WHERE "donorOrgId" = $1 AND "projectId" = $2 AND "revokedAt" IS NULL`,
      donorOrgId, projectId
    )
    if (!access.length) return res.status(403).json({ error: 'No access to this project' })

    const milestones = await prisma.$queryRawUnsafe(
      `SELECT im.*,
              (SELECT row_to_json(latest) FROM (
                SELECT imu.id, imu."newValue", imu.note, imu."evidenceDocumentIds", imu."reportedAt"
                FROM "ImpactMilestoneUpdate" imu
                WHERE imu."milestoneId" = im.id
                ORDER BY imu."reportedAt" DESC LIMIT 1
              ) latest) as "latestUpdate"
       FROM "ImpactMilestone" im
       WHERE im."projectId" = $1
       ORDER BY im."createdAt" ASC`,
      projectId
    )

    // Summary counts
    const total = milestones.length
    const achieved = milestones.filter(m => m.status === 'ACHIEVED').length
    const inProgress = milestones.filter(m => m.status === 'IN_PROGRESS').length
    const notStarted = milestones.filter(m => m.status === 'NOT_STARTED').length

    res.json({
      milestones,
      summary: { total, achieved, inProgress, notStarted, percentAchieved: total > 0 ? Math.round((achieved / total) * 100) : 0 }
    })
  } catch (err) {
    console.error('Get milestones error:', err)
    res.status(500).json({ error: 'Failed to fetch milestones' })
  }
})

// GET /api/donor/projects/:projectId/audit
router.get('/projects/:projectId/audit', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor
    const { projectId } = req.params
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const offset = parseInt(req.query.offset) || 0

    // Verify access
    const access = await prisma.$queryRawUnsafe(
      `SELECT id FROM "DonorProjectAccess" WHERE "donorOrgId" = $1 AND "projectId" = $2 AND "revokedAt" IS NULL`,
      donorOrgId, projectId
    )
    if (!access.length) return res.status(403).json({ error: 'No access' })

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { tenantId: true } })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    // Get project's expense and document IDs to filter audit entries by entityId
    const expenseIds = (await prisma.expense.findMany({ where: { projectId }, select: { id: true } })).map(e => e.id)
    const documentIds = (await prisma.document.findMany({ where: { projectId }, select: { id: true } })).map(d => d.id)
    const entityIds = [...expenseIds, ...documentIds, projectId]

    if (!entityIds.length) return res.json({ entries: [], total: 0 })

    const ph = entityIds.map((_, i) => `$${i + 1}`).join(', ')
    const entries = await prisma.$queryRawUnsafe(
      `SELECT al.id, al.action, al."entityType", al."entityId", al."dataHash", al."prevHash",
              al."blockchainTx", al."createdAt", al."userId", u.name as "userName"
       FROM "AuditLog" al
       LEFT JOIN "User" u ON al."userId" = u.id
       WHERE al."tenantId" = $${entityIds.length + 1} AND al."entityId" IN (${ph})
       ORDER BY al."createdAt" DESC
       LIMIT $${entityIds.length + 2} OFFSET $${entityIds.length + 3}`,
      ...entityIds, project.tenantId, limit, offset
    )

    // Map to frontend-expected shape and enrich expense entries
    const mapped = []
    for (const entry of entries) {
      const e = {
        id: entry.id,
        action: entry.action,
        entity: entry.entityType,
        entityId: entry.entityId,
        hash: entry.dataHash || '',
        prevHash: entry.prevHash || null,
        anchorTxHash: entry.blockchainTx || null,
        createdAt: entry.createdAt,
        expenseId: entry.entityType === 'Expense' ? entry.entityId : null,
      }
      if (entry.entityType === 'Expense' && entry.entityId) {
        try {
          const expense = await prisma.expense.findUnique({
            where: { id: entry.entityId },
            select: { vendor: true, description: true, amount: true, currency: true }
          })
          if (expense) e.expense = { vendor: expense.vendor || expense.description, amount: expense.amount, currency: expense.currency }
        } catch {}
      }
      mapped.push(e)
    }

    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM "AuditLog" WHERE "tenantId" = $${entityIds.length + 1} AND "entityId" IN (${ph})`,
      ...entityIds, project.tenantId
    )

    res.json({ entries: mapped, total: countResult[0]?.total || 0, hasMore: (offset + limit) < (countResult[0]?.total || 0) })
  } catch (err) {
    console.error('Donor audit trail error:', err)
    res.status(500).json({ error: 'Failed to fetch audit trail' })
  }
})

module.exports = router
