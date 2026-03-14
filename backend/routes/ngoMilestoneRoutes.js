// ─────────────────────────────────────────────────────────────
//  routes/ngoMilestoneRoutes.js — Sprint 4
//
//  NGO-side impact milestone management.
//  Uses raw SQL for ImpactMilestone / ImpactMilestoneUpdate / ImpactEvidence.
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')
const { createNotification, notifyDonorOrgsForProject } = require('../services/donorNotificationService')

// All routes require NGO auth
router.use(authenticate, tenantScope)

// GET /api/ngo/milestones/projects/:projectId — List milestones for a project
router.get('/projects/:projectId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { projectId } = req.params

    // Verify project belongs to tenant
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, tenantId: true }
    })
    if (!project || project.tenantId !== tenantId) return res.status(403).json({ error: 'Not your project' })

    const milestones = await prisma.$queryRawUnsafe(
      `SELECT im.* FROM "ImpactMilestone" im
       WHERE im."projectId" = $1
       ORDER BY im."createdAt" ASC`,
      projectId
    )

    // Attach updates for each milestone
    for (const m of milestones) {
      const updates = await prisma.$queryRawUnsafe(
        `SELECT * FROM "ImpactMilestoneUpdate" WHERE "milestoneId" = $1 ORDER BY "reportedAt" DESC`,
        m.id
      )
      m.updates = updates
    }

    res.json({ milestones })
  } catch (err) {
    console.error('NGO get milestones error:', err)
    res.status(500).json({ error: 'Failed to fetch milestones' })
  }
})

// POST /api/ngo/milestones/projects/:projectId — Create milestone
router.post('/projects/:projectId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { projectId } = req.params
    const { title, description, category, metric, targetValue, targetUnit, unit, targetDate } = req.body

    // Accept both 'category' (frontend) and 'metric' (legacy) field names
    const cat = category || metric
    // Accept both 'targetUnit' (frontend) and 'unit' (legacy) field names
    const u = targetUnit || unit

    if (!title || !cat || targetValue === undefined) {
      return res.status(400).json({ error: 'title, category, and targetValue are required' })
    }

    // Verify project belongs to tenant
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, tenantId: true }
    })
    if (!project || project.tenantId !== tenantId) return res.status(403).json({ error: 'Not your project' })

    const milestone = await prisma.$queryRawUnsafe(
      `INSERT INTO "ImpactMilestone" ("projectId", "tenantId", title, description, category, "targetValue", "targetUnit", "targetDate", status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NOT_STARTED') RETURNING *`,
      projectId, tenantId, title, description || null, cat, parseFloat(targetValue),
      u || null, targetDate ? new Date(targetDate) : null
    )

    // Notify donors about new milestone (non-blocking)
    ;(async () => {
      try {
        await notifyDonorOrgsForProject(
          projectId,
          'milestone.created',
          `New milestone — ${title}`,
          `A new impact milestone "${title}" has been added to ${project.name}. Target: ${targetValue}${u ? ' ' + u : ''}.`,
          'milestone',
          milestone[0].id
        )
      } catch (err) { console.error('Milestone create notification error:', err.message) }
    })()

    res.json({ milestone: milestone[0] })
  } catch (err) {
    console.error('NGO create milestone error:', err)
    res.status(500).json({ error: 'Failed to create milestone' })
  }
})

// PUT /api/ngo/milestones/:milestoneId — Update milestone (only if no updates yet)
router.put('/:milestoneId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { milestoneId } = req.params
    const { title, description, category, metric, targetValue, targetUnit, unit, targetDate } = req.body

    // Get milestone and verify tenant ownership
    const milestones = await prisma.$queryRawUnsafe(
      `SELECT * FROM "ImpactMilestone" WHERE id = $1`, milestoneId
    )
    if (!milestones.length) return res.status(404).json({ error: 'Milestone not found' })
    const milestone = milestones[0]

    // Verify project belongs to tenant
    const project = await prisma.project.findUnique({
      where: { id: milestone.projectId },
      select: { tenantId: true }
    })
    if (!project || project.tenantId !== tenantId) return res.status(403).json({ error: 'Not your project' })

    // Check if any updates exist — if so, milestone definition is locked
    const existingUpdates = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM "ImpactMilestoneUpdate" WHERE "milestoneId" = $1`, milestoneId
    )
    if (existingUpdates[0]?.count > 0) {
      return res.status(400).json({ error: 'Cannot edit milestone definition after progress updates have been recorded' })
    }

    // Build SET clause dynamically
    const sets = []
    const values = []
    let idx = 1

    if (title !== undefined) { sets.push(`title = $${idx}`); values.push(title); idx++ }
    if (description !== undefined) { sets.push(`description = $${idx}`); values.push(description); idx++ }
    if (category !== undefined || metric !== undefined) { sets.push(`category = $${idx}`); values.push(category || metric); idx++ }
    if (targetValue !== undefined) { sets.push(`"targetValue" = $${idx}`); values.push(parseFloat(targetValue)); idx++ }
    if (targetUnit !== undefined || unit !== undefined) { sets.push(`"targetUnit" = $${idx}`); values.push(targetUnit || unit); idx++ }
    if (targetDate !== undefined) { sets.push(`"targetDate" = $${idx}`); values.push(targetDate ? new Date(targetDate) : null); idx++ }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' })

    sets.push(`"updatedAt" = NOW()`)
    values.push(milestoneId)

    await prisma.$executeRawUnsafe(
      `UPDATE "ImpactMilestone" SET ${sets.join(', ')} WHERE id = $${idx}`,
      ...values
    )

    const updated = await prisma.$queryRawUnsafe(`SELECT * FROM "ImpactMilestone" WHERE id = $1`, milestoneId)
    res.json({ milestone: updated[0] })
  } catch (err) {
    console.error('NGO update milestone error:', err)
    res.status(500).json({ error: 'Failed to update milestone' })
  }
})

// POST /api/ngo/milestones/:milestoneId/update — Record progress update
router.post('/:milestoneId/update', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { milestoneId } = req.params
    const { currentValue, newValue, note, evidenceIds } = req.body

    // Accept both 'newValue' (frontend) and 'currentValue' (legacy)
    const val = newValue !== undefined ? newValue : currentValue
    if (val === undefined) return res.status(400).json({ error: 'currentValue is required' })

    // Get milestone and verify tenant ownership
    const milestones = await prisma.$queryRawUnsafe(
      `SELECT * FROM "ImpactMilestone" WHERE id = $1`, milestoneId
    )
    if (!milestones.length) return res.status(404).json({ error: 'Milestone not found' })
    const milestone = milestones[0]

    // Verify project belongs to tenant
    const project = await prisma.project.findUnique({
      where: { id: milestone.projectId },
      select: { name: true, tenantId: true }
    })
    if (!project || project.tenantId !== tenantId) return res.status(403).json({ error: 'Not your project' })

    // Create the update record
    const update = await prisma.$queryRawUnsafe(
      `INSERT INTO "ImpactMilestoneUpdate" ("milestoneId", "reportedBy", "newValue", note, "evidenceDocumentIds")
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      milestoneId,
      req.user.userId,
      parseFloat(val),
      note || null,
      evidenceIds ? JSON.stringify(evidenceIds) : null
    )

    // Recalculate milestone status based on currentValue vs targetValue
    const parsedCurrent = parseFloat(val)
    const target = parseFloat(milestone.targetValue)
    let newStatus = 'NOT_STARTED'
    if (parsedCurrent >= target) {
      newStatus = 'ACHIEVED'
    } else if (parsedCurrent > 0) {
      newStatus = 'IN_PROGRESS'
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "ImpactMilestone" SET status = $2, "currentValue" = $3, "updatedAt" = NOW() WHERE id = $1`,
      milestoneId, newStatus, parsedCurrent
    )

    // Notify donors about milestone progress (non-blocking)
    ;(async () => {
      try {
        const pct = target > 0 ? Math.round((parsedCurrent / target) * 100) : 0
        const alertType = newStatus === 'ACHIEVED' ? 'milestone.achieved' : 'milestone.updated'
        const title = newStatus === 'ACHIEVED'
          ? `Milestone achieved — ${milestone.title}`
          : `Milestone progress — ${milestone.title} (${pct}%)`
        const body = newStatus === 'ACHIEVED'
          ? `"${milestone.title}" on ${project.name} has been achieved! Target of ${target}${milestone.unit ? ' ' + milestone.unit : ''} reached.`
          : `"${milestone.title}" on ${project.name} updated to ${parsedCurrent}${milestone.unit ? ' ' + milestone.unit : ''} of ${target}${milestone.unit ? ' ' + milestone.unit : ''} (${pct}%).`

        await notifyDonorOrgsForProject(
          milestone.projectId,
          alertType,
          title,
          body,
          'milestone',
          milestoneId
        )
      } catch (err) { console.error('Milestone update notification error:', err.message) }
    })()

    const updated = await prisma.$queryRawUnsafe(`SELECT * FROM "ImpactMilestone" WHERE id = $1`, milestoneId)
    res.json({ milestone: updated[0], update: update[0] })
  } catch (err) {
    console.error('NGO milestone update error:', err)
    res.status(500).json({ error: 'Failed to record milestone update' })
  }
})

module.exports = router
