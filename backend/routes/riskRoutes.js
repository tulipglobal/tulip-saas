// ─────────────────────────────────────────────────────────────
//  routes/riskRoutes.js — Sprint 8 Section C
//
//  Risk Register CRUD for NGO users.
//  Uses raw SQL for RiskRegister table.
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')

// All routes require NGO auth
router.use(authenticate, tenantScope)

const VALID_CATEGORIES = ['FINANCIAL', 'OPERATIONAL', 'REPUTATIONAL', 'SAFEGUARDING', 'POLITICAL', 'ENVIRONMENTAL', 'OTHER']

// ── GET /api/ngo/projects/:projectId/risks ───────────────────
// Returns risks + summary stats
router.get('/projects/:projectId/risks', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { projectId } = req.params

    // Verify project belongs to tenant
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const rows = await prisma.$queryRawUnsafe(`
      SELECT *, (likelihood * impact) as "riskScore"
      FROM "RiskRegister"
      WHERE "projectId" = $1 AND "tenantId" = $2
      ORDER BY (likelihood * impact) DESC, "createdAt" DESC
    `, projectId, tenantId)

    // Compute summary
    const summary = {
      total: rows.length,
      high: 0,
      medium: 0,
      low: 0,
      open: 0,
      escalated: 0
    }
    for (const r of rows) {
      const score = Number(r.riskScore)
      if (score >= 13) summary.high++
      else if (score >= 7) summary.medium++
      else summary.low++

      const status = (r.status || '').toUpperCase()
      if (status === 'OPEN') summary.open++
      if (status === 'ESCALATED') summary.escalated++
    }

    res.json({ risks: rows, summary })
  } catch (err) {
    console.error('Risk fetch error:', err)
    res.status(500).json({ error: 'Failed to fetch risks' })
  }
})

// ── POST /api/ngo/projects/:projectId/risks ──────────────────
// Create a new risk
router.post('/projects/:projectId/risks', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { projectId } = req.params
    const { description, category, likelihood, impact, mitigation, owner, reviewDate, notes } = req.body

    if (!description) return res.status(400).json({ error: 'Description is required' })

    // Validate category
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` })
    }

    // Validate likelihood and impact (1-5)
    const lh = Number(likelihood)
    const im = Number(impact)
    if (likelihood !== undefined && (isNaN(lh) || lh < 1 || lh > 5)) {
      return res.status(400).json({ error: 'Likelihood must be between 1 and 5' })
    }
    if (impact !== undefined && (isNaN(im) || im < 1 || im > 5)) {
      return res.status(400).json({ error: 'Impact must be between 1 and 5' })
    }

    // Verify project belongs to tenant
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    // Auto-assign riskNumber
    const maxRows = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(MAX("riskNumber"), 0) + 1 as next
      FROM "RiskRegister"
      WHERE "projectId" = $1 AND "tenantId" = $2
    `, projectId, tenantId)
    const riskNumber = Number(maxRows[0].next)

    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO "RiskRegister" (id, "projectId", "tenantId", "riskNumber", description, category, likelihood, impact, mitigation, owner, "reviewDate", notes, status, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'OPEN', NOW(), NOW())
      RETURNING *, (likelihood * impact) as "riskScore"
    `, projectId, tenantId, riskNumber, description, category || 'OTHER', lh || 3, im || 3, mitigation || null, owner || null, reviewDate || null, notes || null)

    res.status(201).json(rows[0])
  } catch (err) {
    console.error('Risk create error:', err)
    res.status(500).json({ error: 'Failed to create risk' })
  }
})

// ── PUT /api/ngo/risks/:riskId ───────────────────────────────
// Update a risk
router.put('/risks/:riskId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { riskId } = req.params
    const { likelihood, impact, mitigation, status, notes, reviewDate, description, category, owner } = req.body

    // Validate belongs to tenant
    const existing = await prisma.$queryRawUnsafe(`
      SELECT id FROM "RiskRegister" WHERE id = $1 AND "tenantId" = $2
    `, riskId, tenantId)
    if (!existing.length) return res.status(404).json({ error: 'Risk not found' })

    // Validate category if provided
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` })
    }

    // Validate likelihood and impact if provided
    if (likelihood !== undefined) {
      const lh = Number(likelihood)
      if (isNaN(lh) || lh < 1 || lh > 5) return res.status(400).json({ error: 'Likelihood must be between 1 and 5' })
    }
    if (impact !== undefined) {
      const im = Number(impact)
      if (isNaN(im) || im < 1 || im > 5) return res.status(400).json({ error: 'Impact must be between 1 and 5' })
    }

    const rows = await prisma.$queryRawUnsafe(`
      UPDATE "RiskRegister"
      SET likelihood = COALESCE($3, likelihood),
          impact = COALESCE($4, impact),
          mitigation = COALESCE($5, mitigation),
          status = COALESCE($6, status),
          notes = COALESCE($7, notes),
          "reviewDate" = COALESCE($8, "reviewDate"),
          description = COALESCE($9, description),
          category = COALESCE($10, category),
          owner = COALESCE($11, owner),
          "lastReviewedAt" = NOW(),
          "updatedAt" = NOW()
      WHERE id = $1 AND "tenantId" = $2
      RETURNING *, (likelihood * impact) as "riskScore"
    `, riskId, tenantId,
      likelihood !== undefined ? Number(likelihood) : null,
      impact !== undefined ? Number(impact) : null,
      mitigation || null, status || null, notes || null,
      reviewDate || null, description || null, category || null, owner || null)

    res.json(rows[0])
  } catch (err) {
    console.error('Risk update error:', err)
    res.status(500).json({ error: 'Failed to update risk' })
  }
})

// ── DELETE /api/ngo/risks/:riskId ────────────────────────────
// Delete a risk
router.delete('/risks/:riskId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { riskId } = req.params

    // Validate belongs to tenant
    const existing = await prisma.$queryRawUnsafe(`
      SELECT id FROM "RiskRegister" WHERE id = $1 AND "tenantId" = $2
    `, riskId, tenantId)
    if (!existing.length) return res.status(404).json({ error: 'Risk not found' })

    await prisma.$executeRawUnsafe(`
      DELETE FROM "RiskRegister" WHERE id = $1 AND "tenantId" = $2
    `, riskId, tenantId)

    res.json({ success: true })
  } catch (err) {
    console.error('Risk delete error:', err)
    res.status(500).json({ error: 'Failed to delete risk' })
  }
})

module.exports = router
