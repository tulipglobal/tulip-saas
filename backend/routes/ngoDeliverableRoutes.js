// ─────────────────────────────────────────────────────────────
//  routes/ngoDeliverableRoutes.js — Sprint 4
//
//  NGO-side deliverable request management.
//  Uses raw SQL for DeliverableRequest / DeliverableSubmission.
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')
const { sendEmail } = require('../services/emailService')
const { createNotification } = require('../services/donorNotificationService')

// All routes require NGO auth
router.use(authenticate, tenantScope)

// GET /api/ngo/deliverables — List all deliverable requests for tenant
router.get('/', async (req, res) => {
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

    if (!projectIds.length) return res.json({ requests: [], counts: { open: 0, rework: 0, overdue: 0 } })

    const placeholders = projectIds.map((_, i) => `$${i + 1}`).join(', ')
    let requests = await prisma.$queryRawUnsafe(
      `SELECT dr.*, do.name as "donorOrgName"
       FROM "DeliverableRequest" dr
       LEFT JOIN "DonorOrganisation" do ON do.id = dr."donorOrgId"
       WHERE dr."projectId" IN (${placeholders})
       ORDER BY dr."createdAt" DESC`,
      ...projectIds
    )

    // Counts (always from full set before filtering)
    const countPlaceholders = projectIds.map((_, i) => `$${i + 1}`).join(', ')
    const countRows = await prisma.$queryRawUnsafe(
      `SELECT
        COUNT(CASE WHEN status = 'OPEN' THEN 1 END)::int as open,
        COUNT(CASE WHEN status = 'REWORK' THEN 1 END)::int as rework,
        COUNT(CASE WHEN status = 'OVERDUE' THEN 1 END)::int as overdue
       FROM "DeliverableRequest" WHERE "projectId" IN (${countPlaceholders})`,
      ...projectIds
    )
    const counts = countRows[0] || { open: 0, rework: 0, overdue: 0 }

    // Apply status filter
    if (statusFilter) {
      const statuses = statusFilter.split(',').map(s => s.trim().toUpperCase())
      requests = requests.filter(r => statuses.includes(r.status))
    }

    // Attach submissions and project name for each request
    for (const r of requests) {
      r.project = { id: r.projectId, name: projectMap[r.projectId] || 'Unknown' }
      const submissions = await prisma.$queryRawUnsafe(
        `SELECT * FROM "DeliverableSubmission" WHERE "requestId" = $1 ORDER BY "createdAt" DESC`,
        r.id
      )
      r.submissions = submissions
    }

    res.json({ requests, counts })
  } catch (err) {
    console.error('NGO get deliverable requests error:', err)
    res.status(500).json({ error: 'Failed to fetch deliverable requests' })
  }
})

// GET /api/ngo/deliverables/count — Return counts of open, rework, overdue
router.get('/count', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const projects = await prisma.project.findMany({
      where: { tenantId },
      select: { id: true }
    })
    const projectIds = projects.map(p => p.id)
    if (!projectIds.length) return res.json({ open: 0, rework: 0, overdue: 0, total: 0 })

    const placeholders = projectIds.map((_, i) => `$${i + 1}`).join(', ')
    const counts = await prisma.$queryRawUnsafe(
      `SELECT
        COUNT(CASE WHEN status = 'OPEN' THEN 1 END)::int as open,
        COUNT(CASE WHEN status = 'REWORK' THEN 1 END)::int as rework,
        COUNT(CASE WHEN status = 'OVERDUE' THEN 1 END)::int as overdue,
        COUNT(CASE WHEN status IN ('OPEN', 'REWORK', 'OVERDUE') THEN 1 END)::int as total
       FROM "DeliverableRequest" WHERE "projectId" IN (${placeholders})`,
      ...projectIds
    )

    res.json(counts[0] || { open: 0, rework: 0, overdue: 0, total: 0 })
  } catch (err) {
    console.error('NGO deliverable count error:', err)
    res.status(500).json({ error: 'Failed to fetch count' })
  }
})

// POST /api/ngo/deliverables/:requestId/submit — Submit a deliverable
router.post('/:requestId/submit', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { requestId } = req.params
    const { note, documentIds, linkUrl } = req.body

    // Get request and verify it belongs to this tenant
    const requests = await prisma.$queryRawUnsafe(
      `SELECT * FROM "DeliverableRequest" WHERE id = $1`, requestId
    )
    if (!requests.length) return res.status(404).json({ error: 'Request not found' })
    const request = requests[0]

    // Verify project belongs to tenant
    const project = await prisma.project.findUnique({
      where: { id: request.projectId },
      select: { name: true, tenantId: true }
    })
    if (!project || project.tenantId !== tenantId) return res.status(403).json({ error: 'Not your project' })

    if (!['OPEN', 'REWORK', 'OVERDUE'].includes(request.status)) {
      return res.status(400).json({ error: 'Request is not in a submittable state' })
    }

    // Create submission
    const submission = await prisma.$queryRawUnsafe(
      `INSERT INTO "DeliverableSubmission" ("requestId", "submittedBy", note, "documentIds", "linkUrl")
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      requestId,
      req.user.userId,
      note || null,
      documentIds ? JSON.stringify(documentIds) : null,
      linkUrl || null
    )

    // Determine new status: RESUBMITTED if was REWORK, else SUBMITTED
    const newStatus = request.status === 'REWORK' ? 'RESUBMITTED' : 'SUBMITTED'
    await prisma.$executeRawUnsafe(
      `UPDATE "DeliverableRequest" SET status = $2, "updatedAt" = NOW() WHERE id = $1`,
      requestId, newStatus
    )

    // Email donor members (non-blocking)
    ;(async () => {
      try {
        const members = await prisma.$queryRawUnsafe(
          `SELECT email, name FROM "DonorMember" WHERE "donorOrgId" = $1`, request.donorOrgId
        )
        const statusLabel = newStatus === 'RESUBMITTED' ? 'resubmitted' : 'submitted'
        for (const m of members.slice(0, 10)) {
          await sendEmail({
            to: m.email,
            subject: `Deliverable ${statusLabel} — ${project.name}`,
            text: `The NGO has ${statusLabel} a deliverable for "${request.title}" on ${project.name}.\n\n${note ? `Note: ${note}\n\n` : ''}Please log in to review: https://donor.sealayer.io`,
            html: `<div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#fff;border-radius:12px"><h1 style="color:#3C3489;font-size:20px">Deliverable ${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}</h1><p style="color:#26215C">The NGO has ${statusLabel} a deliverable for <strong>"${request.title}"</strong> on <strong>${project.name}</strong>.</p>${note ? `<div style="background:#F4F3FE;border:1px solid #E8E6FD;border-radius:8px;padding:16px;margin:16px 0"><p style="margin:0;color:#26215C">${note}</p></div>` : ''}<div style="text-align:center;margin:24px 0"><a href="https://donor.sealayer.io" style="display:inline-block;padding:12px 28px;background:#3C3489;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Review Deliverable</a></div></div>`
          }).catch(() => {})
        }
      } catch (err) { console.error('Deliverable submission email error:', err.message) }
    })()

    // In-app notification for donor
    ;(async () => {
      try {
        const statusLabel = newStatus === 'RESUBMITTED' ? 'resubmitted' : 'submitted'
        await createNotification({
          donorOrgId: request.donorOrgId,
          alertType: 'deliverable.submitted',
          title: `Deliverable ${statusLabel} — ${request.title}`,
          body: `The NGO has ${statusLabel} a deliverable for "${request.title}" on ${project.name}. Log in to review.`,
          entityType: 'deliverable',
          entityId: requestId,
          projectId: request.projectId,
        })
      } catch (err) { console.error('Deliverable notification error:', err.message) }
    })()

    const updated = await prisma.$queryRawUnsafe(`SELECT * FROM "DeliverableRequest" WHERE id = $1`, requestId)
    res.json({ request: updated[0], submission: submission[0] })
  } catch (err) {
    console.error('NGO submit deliverable error:', err)
    res.status(500).json({ error: 'Failed to submit deliverable' })
  }
})

module.exports = router
