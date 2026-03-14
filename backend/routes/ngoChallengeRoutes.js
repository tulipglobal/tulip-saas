const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')
const { sendEmail } = require('../services/emailService')

// GET /api/ngo/donor-challenges
router.get('/', authenticate, tenantScope, async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const statusFilter = req.query.status // comma-separated

    // Get all project IDs for this tenant
    const projects = await prisma.project.findMany({
      where: { tenantId },
      select: { id: true, name: true }
    })
    const projectIds = projects.map(p => p.id)
    const projectMap = {}
    for (const p of projects) projectMap[p.id] = p.name

    if (!projectIds.length) return res.json({ challenges: [], counts: { open: 0, responded: 0, escalated: 0, confirmed: 0 } })

    // Use IN list instead of ANY($1::text[]) for raw query compatibility
    const placeholders = projectIds.map((_, i) => `$${i + 1}`).join(', ')
    let challenges = await prisma.$queryRawUnsafe(
      `SELECT c.* FROM "ExpenseChallenge" c WHERE c."projectId" IN (${placeholders}) ORDER BY c."createdAt" DESC`,
      ...projectIds
    )

    // Apply status filter
    if (statusFilter) {
      const statuses = statusFilter.split(',').map(s => s.trim().toUpperCase())
      challenges = challenges.filter(c => statuses.includes(c.status))
    }

    // Counts (always from full set)
    const countPlaceholders = projectIds.map((_, i) => `$${i + 1}`).join(', ')
    const allChallenges = await prisma.$queryRawUnsafe(
      `SELECT status, COUNT(*)::int as count FROM "ExpenseChallenge" WHERE "projectId" IN (${countPlaceholders}) GROUP BY status`,
      ...projectIds
    )
    const counts = { open: 0, responded: 0, escalated: 0, confirmed: 0 }
    for (const row of allChallenges) {
      const key = row.status.toLowerCase()
      if (counts[key] !== undefined) counts[key] = row.count
    }

    // Enrich challenges
    for (const c of challenges) {
      try {
        const expense = await prisma.expense.findUnique({
          where: { id: c.expenseId },
          select: { id: true, vendor: true, description: true, amount: true, currency: true, ocrDate: true, createdAt: true, projectId: true }
        })
        c.expense = expense ? {
          id: expense.id, vendor: expense.vendor || expense.description, amount: expense.amount,
          currency: expense.currency, expenseDate: expense.ocrDate || expense.createdAt, projectId: expense.projectId
        } : null
      } catch { c.expense = null }

      c.project = { id: c.projectId, name: projectMap[c.projectId] || 'Unknown' }

      try {
        const donorOrg = await prisma.$queryRawUnsafe(`SELECT id, name FROM "DonorOrganisation" WHERE id = $1`, c.donorOrgId)
        c.donorOrg = donorOrg[0] || { id: c.donorOrgId, name: 'Unknown' }
      } catch { c.donorOrg = { id: c.donorOrgId, name: 'Unknown' } }

      const responses = await prisma.$queryRawUnsafe(
        `SELECT * FROM "ExpenseChallengeResponse" WHERE "challengeId" = $1 ORDER BY "createdAt" ASC`, c.id
      )
      c.responses = responses
    }

    res.json({ challenges, counts })
  } catch (err) {
    console.error('NGO get challenges error:', err)
    res.status(500).json({ error: 'Failed to fetch challenges' })
  }
})

// GET /api/ngo/donor-challenges/count
router.get('/count', authenticate, tenantScope, async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const projects = await prisma.project.findMany({
      where: { tenantId },
      select: { id: true }
    })
    const projectIds = projects.map(p => p.id)
    if (!projectIds.length) return res.json({ open: 0, escalated: 0, total: 0 })

    const cntPlaceholders = projectIds.map((_, i) => `$${i + 1}`).join(', ')
    const counts = await prisma.$queryRawUnsafe(
      `SELECT
        COUNT(CASE WHEN status = 'OPEN' THEN 1 END)::int as open,
        COUNT(CASE WHEN status = 'ESCALATED' THEN 1 END)::int as escalated,
        COUNT(CASE WHEN status IN ('OPEN', 'ESCALATED') THEN 1 END)::int as total
       FROM "ExpenseChallenge" WHERE "projectId" IN (${cntPlaceholders})`,
      ...projectIds
    )

    res.json(counts[0] || { open: 0, escalated: 0, total: 0 })
  } catch (err) {
    console.error('NGO challenge count error:', err)
    res.status(500).json({ error: 'Failed to fetch count' })
  }
})

// POST /api/ngo/donor-challenges/:challengeId/respond
router.post('/:challengeId/respond', authenticate, tenantScope, async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { challengeId } = req.params
    const { note, action, resubmittedDocumentId } = req.body
    if (!note || note.length > 500) return res.status(400).json({ error: 'Note is required (max 500 chars)' })
    if (!action || !['EXPLAIN', 'VOID_REQUESTED'].includes(action)) return res.status(400).json({ error: 'action must be EXPLAIN or VOID_REQUESTED' })

    // Get challenge and verify it belongs to this tenant's project
    const challenges = await prisma.$queryRawUnsafe(`SELECT * FROM "ExpenseChallenge" WHERE id = $1`, challengeId)
    if (!challenges.length) return res.status(404).json({ error: 'Challenge not found' })
    const challenge = challenges[0]

    // Verify project belongs to tenant
    const project = await prisma.project.findUnique({ where: { id: challenge.projectId }, select: { name: true, tenantId: true } })
    if (!project || project.tenantId !== tenantId) return res.status(403).json({ error: 'Not your project' })

    if (!['OPEN', 'ESCALATED'].includes(challenge.status)) {
      return res.status(400).json({ error: 'Challenge is not in a flagged state' })
    }

    // Create response
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ExpenseChallengeResponse" ("challengeId", "respondedBy", "respondedByType", note, action, "resubmittedDocumentId")
       VALUES ($1, $2, 'NGO', $3, $4, $5)`,
      challengeId, req.user.userId, note, action, resubmittedDocumentId || null
    )

    // Update challenge status to RESPONDED
    await prisma.$executeRawUnsafe(
      `UPDATE "ExpenseChallenge" SET status = 'RESPONDED', "updatedAt" = NOW() WHERE id = $1`, challengeId
    )

    // If VOID_REQUESTED, log to audit
    if (action === 'VOID_REQUESTED') {
      try {
        await prisma.auditLog.create({
          data: {
            tenantId,
            userId: req.user.userId,
            action: 'VOID_REQUESTED_BY_NGO',
            entityType: 'Expense',
            entityId: challenge.expenseId,
            details: JSON.stringify({ challengeId, reason: 'NGO offered to void in response to donor challenge' }),
            ipAddress: req.ip || 'unknown',
          }
        })
      } catch { /* audit log may fail */ }
    }

    // Get updated challenge with responses
    const updated = await prisma.$queryRawUnsafe(`SELECT * FROM "ExpenseChallenge" WHERE id = $1`, challengeId)
    const responses = await prisma.$queryRawUnsafe(
      `SELECT * FROM "ExpenseChallengeResponse" WHERE "challengeId" = $1 ORDER BY "createdAt" ASC`, challengeId
    )
    updated[0].responses = responses

    // Send email to donor members (non-blocking)
    ;(async () => {
      try {
        const expense = await prisma.expense.findUnique({
          where: { id: challenge.expenseId },
          select: { vendor: true, description: true, amount: true, currency: true }
        })
        const vendor = expense?.vendor || expense?.description || 'Unknown'
        const amount = `${expense?.currency || 'USD'} ${(expense?.amount || 0).toLocaleString()}`
        const actionLabel = action === 'EXPLAIN' ? 'Provided explanation' : 'Offered to void expense'

        const members = await prisma.$queryRawUnsafe(
          `SELECT email FROM "DonorMember" WHERE "donorOrgId" = $1`, challenge.donorOrgId
        )
        for (const m of members) {
          await sendEmail({
            to: m.email,
            subject: `NGO Responded to Your Flag — ${project.name}`,
            text: `The NGO has responded to your flag on ${vendor} — ${amount}.\n\nTheir response: ${actionLabel}\n\nPlease log in to review: https://donor.sealayer.io`,
            html: `<div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#fff;border-radius:12px"><h1 style="color:#3C3489">NGO Responded</h1><p style="color:#26215C">The NGO has responded to your flag on <strong>${vendor} — ${amount}</strong>.</p><div style="background:#F4F3FE;border:1px solid #E8E6FD;border-radius:8px;padding:16px;margin:16px 0"><p style="color:#534AB7;margin:0"><strong>${actionLabel}</strong></p><p style="color:#26215C;margin:8px 0 0">${note}</p></div><div style="text-align:center;margin:24px 0"><a href="https://donor.sealayer.io" style="display:inline-block;padding:12px 28px;background:#3C3489;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Review &amp; Respond</a></div></div>`
          }).catch(() => {})
        }
      } catch (err) { console.error('NGO response email error:', err.message) }
    })()

    res.json({ challenge: updated[0] })
  } catch (err) {
    console.error('NGO challenge respond error:', err)
    res.status(500).json({ error: 'Failed to respond' })
  }
})

module.exports = router
