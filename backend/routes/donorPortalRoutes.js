// ─────────────────────────────────────────────────────────────
//  routes/donorPortalRoutes.js — Donor Portal Sprint 1
//
//  Unified donor portal API routes.
//  Uses raw SQL for DonorOrganisation/DonorMember/DonorProjectAccess
//  and Prisma client for existing models (Project, Expense, etc.)
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')
const { sendEmail } = require('../services/emailService')

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES = '7d'

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
router.post('/auth/invite/accept', async (req, res) => {
  try {
    const { token, name, password } = req.body
    if (!token || !name || !password) {
      return res.status(400).json({ error: 'token, name, and password are required' })
    }

    // Find invite
    const invites = await prisma.$queryRawUnsafe(
      `SELECT * FROM "DonorInvite" WHERE token = $1`,
      token
    )
    if (!invites.length) return res.status(404).json({ error: 'Invite not found' })

    const invite = invites[0]
    if (invite.status !== 'PENDING') return res.status(400).json({ error: 'Invite already used' })
    if (new Date() > new Date(invite.expiresAt)) {
      await prisma.$executeRawUnsafe(
        `UPDATE "DonorInvite" SET status = 'EXPIRED' WHERE id = $1`,
        invite.id
      )
      return res.status(400).json({ error: 'Invite has expired' })
    }

    // Get donor org name — use donorOrgName from invite or email from existing invite
    const donorOrgName = invite.donorOrgName || invite.email

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

    // Create DonorMember
    const passwordHash = await bcrypt.hash(password, 10)
    const existingMember = await prisma.$queryRawUnsafe(
      `SELECT id FROM "DonorMember" WHERE email = $1`,
      invite.email
    )

    let memberId
    if (existingMember.length) {
      memberId = existingMember[0].id
      await prisma.$executeRawUnsafe(
        `UPDATE "DonorMember" SET name = $1, "passwordHash" = $2, "donorOrgId" = $3 WHERE id = $4`,
        name, passwordHash, orgId, memberId
      )
    } else {
      const newMember = await prisma.$queryRawUnsafe(
        `INSERT INTO "DonorMember" (email, name, "passwordHash", "donorOrgId")
         VALUES ($1, $2, $3, $4) RETURNING id`,
        invite.email, name, passwordHash, orgId
      )
      memberId = newMember[0].id
    }

    // Create DonorProjectAccess rows
    // Check if invite has projectIds array or a single projectId
    const projectIds = invite.projectIds || (invite.projectId ? [invite.projectId] : [])
    for (const projectId of projectIds) {
      if (!projectId) continue
      await prisma.$executeRawUnsafe(
        `INSERT INTO "DonorProjectAccess" ("donorOrgId", "projectId", "tenantId", "grantedBy")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("donorOrgId", "projectId") DO NOTHING`,
        orgId, projectId, invite.tenantId, invite.invitedByUserId || invite.invitedBy || 'system'
      )
    }

    // Mark invite accepted
    if (invite.donorOrgName !== undefined) {
      // New-style invite table
      await prisma.$executeRawUnsafe(
        `UPDATE "DonorInvite" SET "acceptedAt" = NOW(), status = 'ACCEPTED' WHERE id = $1`,
        invite.id
      )
    } else {
      // Prisma-managed DonorInvite
      await prisma.donorInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' }
      })
    }

    const jwtToken = jwt.sign(
      { donorMemberId: memberId, donorOrgId: orgId, email: invite.email, role: 'DONOR' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    )

    res.json({
      token: jwtToken,
      user: { id: memberId, email: invite.email, name, donorOrgId: orgId, orgName: donorOrgName }
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
router.get('/projects', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor

    // Get all active project access
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
      ngoMap[p.tenantId].projects.push({
        id: p.id,
        name: p.name,
        description: p.description,
        budget: p.budget,
        status: p.status,
        expenseCount: expenseMap[p.id]?.count || 0,
        spent: expenseMap[p.id]?.spent || 0,
        sealCount: sealMap[p.id] || 0,
        flagCount: flagMap[p.id] || 0,
        documentCount: p._count.documents
      })
    }

    res.json({ ngos: Object.values(ngoMap) })
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
        fundingSources: true,
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

    // Compute budget summary
    const totalBudget = project.budget || 0
    const totalFunded = project.fundingSources?.reduce((s, f) => s + (f.amount || 0), 0) || 0
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
      },
      fundingSources: project.fundingSources?.map(f => ({
        id: f.id, name: f.name, amount: f.amount, currency: f.currency, type: f.type
      })) || [],
      expenses,
    })
  } catch (err) {
    console.error('Donor project detail error:', err)
    res.status(500).json({ error: 'Failed to fetch project' })
  }
})

// ── POST /api/donor/invite (NGO JWT) ──────────────────────────
router.post('/invite', authenticate, tenantScope, async (req, res) => {
  try {
    const { email, donorOrgName, projectIds, message } = req.body
    if (!email || !donorOrgName || !projectIds?.length) {
      return res.status(400).json({ error: 'email, donorOrgName, and projectIds are required' })
    }

    const token = require('crypto').randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // Create DonorInvite in the existing Prisma table
    const invite = await prisma.donorInvite.create({
      data: {
        token,
        email: email.toLowerCase().trim(),
        invitedByUserId: req.user.userId,
        inviteType: 'NGO_INVITES_DONOR',
        tenantId: req.user.tenantId,
        projectId: projectIds[0], // Store first project in existing column
        expiresAt,
      }
    })

    // Store additional project IDs and donorOrgName in raw SQL columns if they exist
    // For now, we store the mapping by creating DonorProjectAccess rows on acceptance

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

    // Store extra metadata for the invite — donorOrgName, all projectIds
    // We store this as a JSON note so the accept handler can use it
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "DonorInvite" SET "inviteType" = $1 WHERE id = $2`,
        JSON.stringify({ type: 'NGO_INVITES_DONOR', donorOrgName, projectIds }),
        invite.id
      )
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
router.get('/invites', authenticate, tenantScope, async (req, res) => {
  try {
    const invites = await prisma.donorInvite.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } }
      }
    })

    const data = invites.map(inv => {
      // Try to parse donorOrgName from inviteType JSON
      let donorOrgName = ''
      let projectIds = []
      try {
        const meta = JSON.parse(inv.inviteType)
        donorOrgName = meta.donorOrgName || ''
        projectIds = meta.projectIds || []
      } catch {
        donorOrgName = inv.inviteType === 'NGO_INVITES_DONOR' ? '' : ''
      }

      return {
        id: inv.id,
        email: inv.email,
        donorOrgName,
        projectIds,
        projectName: inv.project?.name || null,
        status: inv.status,
        expiresAt: inv.expiresAt,
        sentAt: inv.createdAt,
      }
    })

    res.json({ data })
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

    res.json({
      email: invite.email,
      donorOrgName,
      tenantName: invite.tenant?.name || 'An organisation',
      tenantId: invite.tenantId,
      projectIds,
      projectNames,
      expiresAt: invite.expiresAt,
    })
  } catch (err) {
    console.error('Validate invite error:', err)
    res.status(500).json({ error: 'Failed to validate invite' })
  }
})

module.exports = router
