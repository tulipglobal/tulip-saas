// ─────────────────────────────────────────────────────────────
//  routes/ngoInvestmentRoutes.js — Sprint 5
//
//  NGO-side impact investment management.
//  Uses raw SQL for ImpactInvestment / RepaymentSchedule /
//  Drawdown / Covenant tables.
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')
const { sendEmail } = require('../services/emailService')
const { createNotification, notifyDonorOrgsForProject } = require('../services/donorNotificationService')

// All routes require NGO auth
router.use(authenticate, tenantScope)

// ── GET / — List all investments for this tenant ────────────
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.tenantId

    // Get all project IDs for this tenant
    const projects = await prisma.project.findMany({
      where: { tenantId },
      select: { id: true, name: true }
    })
    const projectIds = projects.map(p => p.id)
    const projectMap = {}
    for (const p of projects) projectMap[p.id] = p.name

    if (!projectIds.length) return res.json({ investments: [] })

    const placeholders = projectIds.map((_, i) => `$${i + 1}`).join(', ')
    const investments = await prisma.$queryRawUnsafe(
      `SELECT ii.*, dorg.name as "donorOrgName"
       FROM "ImpactInvestment" ii
       LEFT JOIN "DonorOrganisation" dorg ON dorg.id = ii."donorOrgId"
       WHERE ii."projectId" IN (${placeholders})
       ORDER BY ii."createdAt" DESC`,
      ...projectIds
    )

    for (const inv of investments) {
      inv.projectName = projectMap[inv.projectId] || 'Unknown'

      // Repayment summary
      const schedule = await prisma.$queryRawUnsafe(
        `SELECT * FROM "RepaymentSchedule"
         WHERE "investmentId" = $1
         ORDER BY "instalmentNumber" ASC`,
        inv.id
      )
      const totalPaid = schedule
        .filter(s => s.status === 'PAID' || s.status === 'PARTIAL')
        .reduce((sum, s) => sum + (parseFloat(s.paidAmount) || 0), 0)
      const totalDue = schedule.reduce((sum, s) => sum + (parseFloat(s.totalDue) || 0), 0)
      const overdueCount = schedule.filter(s => s.status === 'OVERDUE').length
      const nextRepayment = schedule.find(s => s.status === 'PENDING' || s.status === 'OVERDUE') || null

      inv.repaymentSummary = { totalPaid, totalDue, overdueCount, nextRepayment, instalmentCount: schedule.length }

      // Covenant status
      const covenants = await prisma.$queryRawUnsafe(
        `SELECT * FROM "Covenant"
         WHERE "investmentId" = $1
         ORDER BY "createdAt" ASC`,
        inv.id
      )
      inv.covenants = covenants
      inv.covenantBreaches = covenants.filter(c => c.status === 'BREACH').length

      // Drawdowns
      inv.drawdowns = await prisma.$queryRawUnsafe(
        `SELECT * FROM "Drawdown"
         WHERE "investmentId" = $1
         ORDER BY "createdAt" DESC`,
        inv.id
      )
    }

    res.json({ investments })
  } catch (err) {
    console.error('NGO list investments error:', err)
    res.status(500).json({ error: 'Failed to fetch investments' })
  }
})

// ── POST /:investmentId/drawdowns — Request a drawdown ──────
router.post('/:investmentId/drawdowns', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { investmentId } = req.params
    const { amount, currency, purpose } = req.body

    if (!amount || !currency) {
      return res.status(400).json({ error: 'amount and currency are required' })
    }

    // Verify investment belongs to tenant's project
    const inv = await prisma.$queryRawUnsafe(
      `SELECT ii.id, ii."projectId", ii."donorOrgId"
       FROM "ImpactInvestment" ii
       JOIN "Project" p ON p.id = ii."projectId"
       WHERE ii.id = $1 AND p."tenantId" = $2`,
      investmentId, tenantId
    )
    if (!inv.length) return res.status(404).json({ error: 'Investment not found' })

    const investment = inv[0]

    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO "Drawdown" (
        "investmentId", amount, currency, purpose, status, "requestedBy"
      ) VALUES ($1, $2, $3, $4, 'REQUESTED', $5)
      RETURNING *`,
      investmentId, parseFloat(amount), currency, purpose || null, req.user.userId
    )
    const drawdown = rows[0]

    // Get project name
    const project = await prisma.project.findUnique({
      where: { id: investment.projectId },
      select: { name: true }
    })
    const projectName = project?.name || 'Unknown Project'

    // Send email to donor members
    const donorMembers = await prisma.$queryRawUnsafe(
      `SELECT email, name FROM "DonorMember"
       WHERE "donorOrgId" = $1 AND status = 'ACTIVE'`,
      investment.donorOrgId
    )

    for (const member of donorMembers) {
      await sendEmail({
        to: member.email,
        subject: `Drawdown Requested — ${projectName}`,
        html: `<p>Hi ${member.name || 'there'},</p>
               <p>A new drawdown has been requested for project <strong>${projectName}</strong>.</p>
               <p><strong>Amount:</strong> ${amount} ${currency}</p>
               <p><strong>Purpose:</strong> ${purpose || 'N/A'}</p>
               <p>Please log in to review and approve or reject this request.</p>`
      })
    }

    // Create donor notification
    await createNotification({
      donorOrgId: investment.donorOrgId,
      alertType: 'DRAWDOWN_REQUESTED',
      title: `Drawdown requested for ${projectName}`,
      body: `Amount: ${amount} ${currency}. Purpose: ${purpose || 'N/A'}`,
      entityType: 'DRAWDOWN',
      entityId: drawdown.id,
      projectId: investment.projectId
    })

    res.status(201).json({ drawdown })
  } catch (err) {
    console.error('NGO create drawdown error:', err)
    res.status(500).json({ error: 'Failed to create drawdown' })
  }
})

// ── POST /drawdowns/:drawdownId/utilisation ─────────────────
router.post('/drawdowns/:drawdownId/utilisation', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { drawdownId } = req.params
    const { utilisationAmount } = req.body

    if (utilisationAmount === undefined) {
      return res.status(400).json({ error: 'utilisationAmount is required' })
    }

    // Verify drawdown belongs to tenant's project
    const dd = await prisma.$queryRawUnsafe(
      `SELECT d.id, d."investmentId"
       FROM "Drawdown" d
       JOIN "ImpactInvestment" ii ON ii.id = d."investmentId"
       JOIN "Project" p ON p.id = ii."projectId"
       WHERE d.id = $1 AND p."tenantId" = $2`,
      drawdownId, tenantId
    )
    if (!dd.length) return res.status(404).json({ error: 'Drawdown not found' })

    const updated = await prisma.$queryRawUnsafe(
      `UPDATE "Drawdown"
       SET "utilisationAmount" = $1, "updatedAt" = NOW()
       WHERE id = $2
       RETURNING *`,
      parseFloat(utilisationAmount), drawdownId
    )

    res.json({ drawdown: updated[0] })
  } catch (err) {
    console.error('NGO update utilisation error:', err)
    res.status(500).json({ error: 'Failed to update utilisation' })
  }
})

// ── GET /:investmentId/covenants ────────────────────────────
router.get('/:investmentId/covenants', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { investmentId } = req.params

    // Verify investment belongs to tenant's project
    const inv = await prisma.$queryRawUnsafe(
      `SELECT ii.id FROM "ImpactInvestment" ii
       JOIN "Project" p ON p.id = ii."projectId"
       WHERE ii.id = $1 AND p."tenantId" = $2`,
      investmentId, tenantId
    )
    if (!inv.length) return res.status(404).json({ error: 'Investment not found' })

    const covenants = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Covenant"
       WHERE "investmentId" = $1
       ORDER BY "createdAt" ASC`,
      investmentId
    )

    res.json({ covenants })
  } catch (err) {
    console.error('NGO get covenants error:', err)
    res.status(500).json({ error: 'Failed to fetch covenants' })
  }
})

// ── PUT /covenants/:covenantId/status ───────────────────────
router.put('/covenants/:covenantId/status', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { covenantId } = req.params
    const { status, notes } = req.body

    if (!status) {
      return res.status(400).json({ error: 'status is required' })
    }

    // Verify covenant's investment belongs to tenant
    const cov = await prisma.$queryRawUnsafe(
      `SELECT c.id, c."investmentId", ii."projectId", ii."donorOrgId"
       FROM "Covenant" c
       JOIN "ImpactInvestment" ii ON ii.id = c."investmentId"
       JOIN "Project" p ON p.id = ii."projectId"
       WHERE c.id = $1 AND p."tenantId" = $2`,
      covenantId, tenantId
    )
    if (!cov.length) return res.status(404).json({ error: 'Covenant not found' })

    const covenant = cov[0]

    const updated = await prisma.$queryRawUnsafe(
      `UPDATE "Covenant"
       SET status = $1, notes = $2, "lastCheckedAt" = NOW(), "updatedAt" = NOW()
       WHERE id = $3
       RETURNING *`,
      status, notes || null, covenantId
    )

    // If BREACH, notify donor org
    if (status === 'BREACH') {
      const project = await prisma.project.findUnique({
        where: { id: covenant.projectId },
        select: { name: true }
      })
      const projectName = project?.name || 'Unknown Project'

      await createNotification({
        donorOrgId: covenant.donorOrgId,
        alertType: 'COVENANT_BREACH',
        title: `Covenant breach on ${projectName}`,
        body: `Covenant status set to BREACH. ${notes || ''}`.trim(),
        entityType: 'COVENANT',
        entityId: covenantId,
        projectId: covenant.projectId
      })

      // Also notify all donor orgs with access to this project
      await notifyDonorOrgsForProject(
        covenant.projectId,
        'COVENANT_BREACH',
        `Covenant breach on ${projectName}`,
        `A covenant has been marked as BREACH. ${notes || ''}`.trim(),
        'COVENANT',
        covenantId
      )
    }

    res.json({ covenant: updated[0] })
  } catch (err) {
    console.error('NGO update covenant status error:', err)
    res.status(500).json({ error: 'Failed to update covenant status' })
  }
})

module.exports = router
