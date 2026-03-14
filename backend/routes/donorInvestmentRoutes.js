// ─────────────────────────────────────────────────────────────
//  routes/donorInvestmentRoutes.js — Sprint 5
//
//  Donor-side impact investment management.
//  Uses raw SQL for ImpactInvestment / RepaymentSchedule /
//  Drawdown / Covenant tables.
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const prisma = require('../lib/client')
const { sendEmail } = require('../services/emailService')
const { createNotification, notifyDonorOrgsForProject } = require('../services/donorNotificationService')

// ── Donor auth middleware ───────────────────────────────────
async function donorAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'No token' })
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded.donorMemberId) return res.status(401).json({ error: 'Not a donor token' })
    req.donor = { donorMemberId: decoded.donorMemberId, donorOrgId: decoded.donorOrgId }
    next()
  } catch { return res.status(401).json({ error: 'Invalid token' }) }
}

// ── GET /projects/:projectId/funding-breakdown ──────────────
router.get('/projects/:projectId/funding-breakdown', donorAuth, async (req, res) => {
  try {
    const { projectId } = req.params
    const { donorOrgId } = req.donor

    const rows = await prisma.$queryRawUnsafe(
      `SELECT pf.*, fa.title as "agreementName", fa."donorOrgId", fa."funderType",
              fa.currency, fa.status as "agreementStatus", fa."totalAmount",
              dorg.name as "donorOrgName"
       FROM "ProjectFunding" pf
       JOIN "FundingAgreement" fa ON fa.id = pf."fundingAgreementId"
       LEFT JOIN "DonorOrganisation" dorg ON dorg.id = fa."donorOrgId"
       WHERE pf."projectId" = $1::uuid
         AND fa."funderType" = 'PORTAL'
         AND fa."donorOrgId" IS NOT NULL
       ORDER BY fa."createdAt" DESC`,
      projectId
    )

    const breakdown = rows.map(row => ({
      ...row,
      isOwnOrg: row.donorOrgId === donorOrgId
    }))

    // Calculate totals by currency
    const totalsByCurrency = {}
    for (const row of breakdown) {
      const cur = row.currency || 'USD'
      if (!totalsByCurrency[cur]) totalsByCurrency[cur] = 0
      totalsByCurrency[cur] += parseFloat(row.allocatedAmount) || 0
    }

    res.json({ breakdown, totalsByCurrency })
  } catch (err) {
    console.error('Donor funding breakdown error:', err)
    res.status(500).json({ error: 'Failed to fetch funding breakdown' })
  }
})

// ── GET /projects/:projectId/investments ────────────────────
router.get('/projects/:projectId/investments', donorAuth, async (req, res) => {
  try {
    const { projectId } = req.params
    const { donorOrgId } = req.donor

    // Show investments belonging to this donor org, OR created by NGO without
    // a donor org assigned (but donor has project access via DonorProjectAccess)
    const hasAccess = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "DonorProjectAccess" WHERE "donorOrgId" = $1 AND "projectId" = $2 AND "revokedAt" IS NULL LIMIT 1`,
      donorOrgId, projectId
    )

    const investments = await prisma.$queryRawUnsafe(
      `SELECT * FROM "ImpactInvestment"
       WHERE "projectId" = $1::uuid AND ("donorOrgId" = $2::uuid${hasAccess.length > 0 ? ' OR "donorOrgId" IS NULL' : ''})
       ORDER BY "createdAt" DESC`,
      projectId, donorOrgId
    )

    for (const inv of investments) {
      // Repayment schedule
      inv.schedule = await prisma.$queryRawUnsafe(
        `SELECT * FROM "RepaymentSchedule"
         WHERE "investmentId" = $1::uuid
         ORDER BY "instalmentNumber" ASC`,
        inv.id
      )

      // Drawdowns
      inv.drawdowns = await prisma.$queryRawUnsafe(
        `SELECT * FROM "Drawdown"
         WHERE "investmentId" = $1::uuid
         ORDER BY "createdAt" DESC`,
        inv.id
      )

      // Covenants
      inv.covenants = await prisma.$queryRawUnsafe(
        `SELECT * FROM "Covenant"
         WHERE "investmentId" = $1::uuid
         ORDER BY "createdAt" ASC`,
        inv.id
      )

      // Calculate financials
      const paidInstalments = inv.schedule.filter(
        s => s.status === 'PAID' || s.status === 'PARTIAL'
      )
      const totalPaidPrincipal = paidInstalments.reduce(
        (sum, s) => sum + (parseFloat(s.paidAmount) || 0), 0
      )
      const totalFacility = parseFloat(inv.totalFacility) || 0
      inv.outstandingPrincipal = totalFacility - totalPaidPrincipal

      // Accrued interest
      const startDate = new Date(inv.startDate || inv.createdAt)
      const daysElapsed = Math.max(0, (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const interestRate = parseFloat(inv.interestRate) || 0
      inv.accruedInterest = Math.round(
        (inv.outstandingPrincipal * (interestRate / 100) * (daysElapsed / 365)) * 100
      ) / 100

      // Total interest paid
      inv.totalInterestPaid = inv.schedule
        .filter(s => s.status === 'PAID')
        .reduce((sum, s) => sum + (parseFloat(s.interestDue) || 0), 0)

      // Next repayment
      const upcoming = inv.schedule.filter(s => s.status === 'PENDING' || s.status === 'OVERDUE')
      inv.nextRepayment = upcoming.length > 0 ? upcoming[0] : null

      // Overdue count
      inv.overdueCount = inv.schedule.filter(s => s.status === 'OVERDUE').length
    }

    res.json({ investments })
  } catch (err) {
    console.error('Donor get investments error:', err)
    res.status(500).json({ error: 'Failed to fetch investments' })
  }
})

// ── POST /projects/:projectId/investments ───────────────────
router.post('/projects/:projectId/investments', donorAuth, async (req, res) => {
  try {
    const { projectId } = req.params
    const { donorOrgId, donorMemberId } = req.donor
    const {
      instrumentType, totalFacility, currency, interestRate,
      termMonths, gracePeriodMonths, startDate, notes
    } = req.body

    if (!instrumentType || !totalFacility || !currency) {
      return res.status(400).json({ error: 'instrumentType, totalFacility, and currency are required' })
    }

    const rows = await prisma.$queryRawUnsafe(
      `INSERT INTO "ImpactInvestment" (
        "projectId", "donorOrgId", "createdBy", "investmentType",
        "totalFacility", currency, "interestRate", "termMonths",
        "gracePeriodMonths", "startDate", notes, status
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, 'ACTIVE')
      RETURNING *`,
      projectId, donorOrgId, donorMemberId, instrumentType,
      parseFloat(totalFacility), currency, parseFloat(interestRate) || 0,
      parseInt(termMonths) || null, parseInt(gracePeriodMonths) || 0,
      startDate ? new Date(startDate) : new Date(), notes || null
    )

    const investment = rows[0]

    // Auto-generate repayment schedule if termMonths provided
    if (termMonths) {
      const term = parseInt(termMonths)
      const grace = parseInt(gracePeriodMonths) || 0
      const repaymentMonths = term - grace
      const facility = parseFloat(totalFacility)
      const rate = parseFloat(interestRate) || 0
      const principalDue = facility / repaymentMonths
      const investmentStartDate = startDate ? new Date(startDate) : new Date()
      let remainingPrincipal = facility

      investment.schedule = []

      for (let i = 1; i <= repaymentMonths; i++) {
        const dueDate = new Date(investmentStartDate)
        dueDate.setMonth(dueDate.getMonth() + grace + i)

        const interestDue = Math.round((remainingPrincipal * (rate / 100 / 12)) * 100) / 100
        const totalDue = Math.round((principalDue + interestDue) * 100) / 100

        const instalment = await prisma.$queryRawUnsafe(
          `INSERT INTO "RepaymentSchedule" (
            "investmentId", "instalmentNumber", "dueDate",
            "principalDue", "interestDue", "totalDue", status
          ) VALUES ($1::uuid, $2, $3, $4, $5, $6, 'PENDING')
          RETURNING *`,
          investment.id, i, dueDate,
          Math.round(principalDue * 100) / 100,
          interestDue, totalDue
        )

        investment.schedule.push(instalment[0])
        remainingPrincipal -= principalDue
      }
    }

    res.status(201).json({ investment })
  } catch (err) {
    console.error('Donor create investment error:', err)
    res.status(500).json({ error: 'Failed to create investment' })
  }
})

// ── GET /investments/:investmentId/schedule ──────────────────
router.get('/investments/:investmentId/schedule', donorAuth, async (req, res) => {
  try {
    const { investmentId } = req.params
    const { donorOrgId } = req.donor

    // Verify ownership
    const inv = await prisma.$queryRawUnsafe(
      `SELECT id FROM "ImpactInvestment" WHERE id = $1::uuid AND "donorOrgId" = $2::uuid`,
      investmentId, donorOrgId
    )
    if (!inv.length) return res.status(404).json({ error: 'Investment not found' })

    const schedule = await prisma.$queryRawUnsafe(
      `SELECT * FROM "RepaymentSchedule"
       WHERE "investmentId" = $1::uuid
       ORDER BY "instalmentNumber" ASC`,
      investmentId
    )

    res.json({ schedule })
  } catch (err) {
    console.error('Donor get schedule error:', err)
    res.status(500).json({ error: 'Failed to fetch schedule' })
  }
})

// ── POST /investments/:investmentId/record-payment ──────────
router.post('/investments/:investmentId/record-payment', donorAuth, async (req, res) => {
  try {
    const { investmentId } = req.params
    const { donorOrgId } = req.donor
    const { instalmentId, paidAmount, paidDate } = req.body

    if (!instalmentId || paidAmount === undefined) {
      return res.status(400).json({ error: 'instalmentId and paidAmount are required' })
    }

    // Verify ownership
    const inv = await prisma.$queryRawUnsafe(
      `SELECT id FROM "ImpactInvestment" WHERE id = $1::uuid AND "donorOrgId" = $2::uuid`,
      investmentId, donorOrgId
    )
    if (!inv.length) return res.status(404).json({ error: 'Investment not found' })

    // Get instalment
    const instalments = await prisma.$queryRawUnsafe(
      `SELECT * FROM "RepaymentSchedule" WHERE id = $1::uuid AND "investmentId" = $2::uuid`,
      instalmentId, investmentId
    )
    if (!instalments.length) return res.status(404).json({ error: 'Instalment not found' })

    const instalment = instalments[0]
    const paid = parseFloat(paidAmount)
    const totalDue = parseFloat(instalment.totalDue) || 0
    const newStatus = paid >= totalDue ? 'PAID' : 'PARTIAL'

    const updated = await prisma.$queryRawUnsafe(
      `UPDATE "RepaymentSchedule"
       SET "paidAmount" = $1, "paidDate" = $2, status = $3, "updatedAt" = NOW()
       WHERE id = $4::uuid
       RETURNING *`,
      paid, paidDate ? new Date(paidDate) : new Date(), newStatus, instalmentId
    )

    res.json({ instalment: updated[0] })
  } catch (err) {
    console.error('Donor record payment error:', err)
    res.status(500).json({ error: 'Failed to record payment' })
  }
})

// ── GET /investments/:investmentId/drawdowns ────────────────
router.get('/investments/:investmentId/drawdowns', donorAuth, async (req, res) => {
  try {
    const { investmentId } = req.params
    const { donorOrgId } = req.donor

    // Verify ownership
    const inv = await prisma.$queryRawUnsafe(
      `SELECT id FROM "ImpactInvestment" WHERE id = $1::uuid AND "donorOrgId" = $2::uuid`,
      investmentId, donorOrgId
    )
    if (!inv.length) return res.status(404).json({ error: 'Investment not found' })

    const drawdowns = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Drawdown"
       WHERE "investmentId" = $1::uuid
       ORDER BY "createdAt" DESC`,
      investmentId
    )

    res.json({ drawdowns })
  } catch (err) {
    console.error('Donor get drawdowns error:', err)
    res.status(500).json({ error: 'Failed to fetch drawdowns' })
  }
})

// ── POST /investments/:investmentId/drawdowns/:id/approve ───
router.post('/investments/:investmentId/drawdowns/:id/approve', donorAuth, async (req, res) => {
  try {
    const { investmentId, id } = req.params
    const { donorOrgId, donorMemberId } = req.donor

    // Verify ownership
    const inv = await prisma.$queryRawUnsafe(
      `SELECT ii.id, ii."projectId" FROM "ImpactInvestment" ii
       WHERE ii.id = $1::uuid AND ii."donorOrgId" = $2::uuid`,
      investmentId, donorOrgId
    )
    if (!inv.length) return res.status(404).json({ error: 'Investment not found' })

    const updated = await prisma.$queryRawUnsafe(
      `UPDATE "Drawdown"
       SET status = 'APPROVED', "approvedDate" = NOW(), "approvedBy" = $1::uuid, "updatedAt" = NOW()
       WHERE id = $2::uuid AND "investmentId" = $3::uuid
       RETURNING *`,
      donorMemberId, id, investmentId
    )
    if (!updated.length) return res.status(404).json({ error: 'Drawdown not found' })

    // Get project name for email
    const projectId = inv[0].projectId
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, tenantId: true }
    })

    // Send email to NGO admins
    if (project) {
      const ngoAdmins = await prisma.user.findMany({
        where: { tenantId: project.tenantId, status: 'ACTIVE' },
        select: { email: true, name: true }
      })

      for (const admin of ngoAdmins) {
        await sendEmail({
          to: admin.email,
          subject: `Drawdown Approved — ${project.name}`,
          html: `<p>Hi ${admin.name || 'there'},</p>
                 <p>A drawdown request for project <strong>${project.name}</strong> has been approved.</p>
                 <p><strong>Amount:</strong> ${updated[0].amount} ${updated[0].currency || ''}</p>
                 <p><strong>Purpose:</strong> ${updated[0].purpose || 'N/A'}</p>`
        })
      }

      // Create donor notification
      await createNotification({
        donorOrgId,
        alertType: 'DRAWDOWN_APPROVED',
        title: `Drawdown approved for ${project.name}`,
        body: `Amount: ${updated[0].amount} ${updated[0].currency || ''}`,
        entityType: 'DRAWDOWN',
        entityId: id,
        projectId
      })
    }

    res.json({ drawdown: updated[0] })
  } catch (err) {
    console.error('Donor approve drawdown error:', err)
    res.status(500).json({ error: 'Failed to approve drawdown' })
  }
})

// ── POST /investments/:investmentId/drawdowns/:id/reject ────
router.post('/investments/:investmentId/drawdowns/:id/reject', donorAuth, async (req, res) => {
  try {
    const { investmentId, id } = req.params
    const { donorOrgId } = req.donor
    const { reason } = req.body

    // Verify ownership
    const inv = await prisma.$queryRawUnsafe(
      `SELECT ii.id, ii."projectId" FROM "ImpactInvestment" ii
       WHERE ii.id = $1::uuid AND ii."donorOrgId" = $2::uuid`,
      investmentId, donorOrgId
    )
    if (!inv.length) return res.status(404).json({ error: 'Investment not found' })

    const updated = await prisma.$queryRawUnsafe(
      `UPDATE "Drawdown"
       SET status = 'REJECTED', "rejectionReason" = $1, "updatedAt" = NOW()
       WHERE id = $2::uuid AND "investmentId" = $3::uuid
       RETURNING *`,
      reason || null, id, investmentId
    )
    if (!updated.length) return res.status(404).json({ error: 'Drawdown not found' })

    // Send email to NGO admins
    const projectId = inv[0].projectId
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, tenantId: true }
    })

    if (project) {
      const ngoAdmins = await prisma.user.findMany({
        where: { tenantId: project.tenantId, status: 'ACTIVE' },
        select: { email: true, name: true }
      })

      for (const admin of ngoAdmins) {
        await sendEmail({
          to: admin.email,
          subject: `Drawdown Rejected — ${project.name}`,
          html: `<p>Hi ${admin.name || 'there'},</p>
                 <p>A drawdown request for project <strong>${project.name}</strong> has been rejected.</p>
                 <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
                 <p><strong>Amount:</strong> ${updated[0].amount} ${updated[0].currency || ''}</p>`
        })
      }
    }

    res.json({ drawdown: updated[0] })
  } catch (err) {
    console.error('Donor reject drawdown error:', err)
    res.status(500).json({ error: 'Failed to reject drawdown' })
  }
})

// ── GET /investments — Portfolio view (all investments) ──────
router.get('/investments', donorAuth, async (req, res) => {
  try {
    const { donorOrgId } = req.donor

    // Include investments assigned to this donor org, plus any unassigned ones
    // on projects this donor has access to
    const accessibleProjects = await prisma.$queryRawUnsafe(
      `SELECT "projectId" FROM "DonorProjectAccess" WHERE "donorOrgId" = $1 AND "revokedAt" IS NULL`,
      donorOrgId
    )
    const accessibleProjectIds = accessibleProjects.map(r => r.projectId)

    let investments
    if (accessibleProjectIds.length > 0) {
      const placeholders = accessibleProjectIds.map((_, i) => `$${i + 2}::uuid`).join(', ')
      investments = await prisma.$queryRawUnsafe(
        `SELECT ii.*, p.name as "projectName"
         FROM "ImpactInvestment" ii
         LEFT JOIN "Project" p ON p.id = ii."projectId"::text
         WHERE ii."donorOrgId" = $1::uuid OR (ii."donorOrgId" IS NULL AND ii."projectId" IN (${placeholders}))
         ORDER BY ii."createdAt" DESC`,
        donorOrgId, ...accessibleProjectIds
      )
    } else {
      investments = await prisma.$queryRawUnsafe(
        `SELECT ii.*, p.name as "projectName"
         FROM "ImpactInvestment" ii
         LEFT JOIN "Project" p ON p.id = ii."projectId"::text
         WHERE ii."donorOrgId" = $1::uuid
         ORDER BY ii."createdAt" DESC`,
        donorOrgId
      )
    }

    for (const inv of investments) {
      // Get schedule summary
      const schedule = await prisma.$queryRawUnsafe(
        `SELECT * FROM "RepaymentSchedule"
         WHERE "investmentId" = $1::uuid
         ORDER BY "instalmentNumber" ASC`,
        inv.id
      )

      // Next repayment
      const upcoming = schedule.filter(s => s.status === 'PENDING' || s.status === 'OVERDUE')
      inv.nextRepayment = upcoming.length > 0 ? upcoming[0] : null

      // Overdue count
      inv.overdueCount = schedule.filter(s => s.status === 'OVERDUE').length

      // Outstanding principal
      const paidInstalments = schedule.filter(s => s.status === 'PAID' || s.status === 'PARTIAL')
      const totalPaidPrincipal = paidInstalments.reduce(
        (sum, s) => sum + (parseFloat(s.paidAmount) || 0), 0
      )
      inv.outstandingPrincipal = (parseFloat(inv.totalFacility) || 0) - totalPaidPrincipal
    }

    res.json({ investments })
  } catch (err) {
    console.error('Donor portfolio error:', err)
    res.status(500).json({ error: 'Failed to fetch investment portfolio' })
  }
})

module.exports = router
