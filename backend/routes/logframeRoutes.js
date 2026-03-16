// ─────────────────────────────────────────────────────────────
//  routes/logframeRoutes.js — Sprint 8 Section B
//
//  Logframe (outputs + indicators) CRUD for NGO users.
//  Uses raw SQL for LogframeOutput / LogframeIndicator tables.
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')

// All routes require NGO auth
router.use(authenticate, tenantScope)

// ── GET /api/ngo/projects/:projectId/logframe ────────────────
// Returns all outputs with nested indicators
router.get('/projects/:projectId/logframe', async (req, res) => {
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
      SELECT lo.*, json_agg(
        json_build_object(
          'id', li.id, 'indicator', li.indicator,
          'baselineValue', li."baselineValue", 'targetValue', li."targetValue",
          'actualValue', li."actualValue", 'unit', li.unit,
          'ragStatus', li."ragStatus", 'reportingPeriod', li."reportingPeriod",
          'notes', li.notes, 'lastUpdatedAt', li."lastUpdatedAt",
          'measurementMethod', li."measurementMethod"
        ) ORDER BY li."createdAt"
      ) FILTER (WHERE li.id IS NOT NULL) as indicators
      FROM "LogframeOutput" lo
      LEFT JOIN "LogframeIndicator" li ON li."outputId" = lo.id
      WHERE lo."projectId" = $1 AND lo."tenantId" = $2
      GROUP BY lo.id
      ORDER BY lo."outputNumber"
    `, projectId, tenantId)

    // Replace null indicators with empty array
    const outputs = rows.map(r => ({
      ...r,
      indicators: r.indicators || []
    }))

    res.json({ outputs })
  } catch (err) {
    console.error('Logframe fetch error:', err)
    res.status(500).json({ error: 'Failed to fetch logframe' })
  }
})

// ── POST /api/ngo/projects/:projectId/logframe/outputs ───────
// Create a new output
router.post('/projects/:projectId/logframe/outputs', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { projectId } = req.params
    const { outputNumber, title, description } = req.body

    if (!title) return res.status(400).json({ error: 'Title is required' })

    // Verify project belongs to tenant
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    // Auto-assign outputNumber if not provided
    let assignedNumber = outputNumber
    if (!assignedNumber) {
      const maxRows = await prisma.$queryRawUnsafe(`
        SELECT COALESCE(MAX("outputNumber"), 0) + 1 as next
        FROM "LogframeOutput"
        WHERE "projectId" = $1 AND "tenantId" = $2
      `, projectId, tenantId)
      assignedNumber = Number(maxRows[0].next)
    }

    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO "LogframeOutput" (id, "projectId", "tenantId", "outputNumber", title, description, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `, projectId, tenantId, assignedNumber, title, description || null)

    res.status(201).json(rows[0])
  } catch (err) {
    console.error('Logframe output create error:', err)
    res.status(500).json({ error: 'Failed to create output' })
  }
})

// ── PUT /api/ngo/logframe/outputs/:outputId ──────────────────
// Update an output
router.put('/logframe/outputs/:outputId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { outputId } = req.params
    const { title, description } = req.body

    // Validate belongs to tenant
    const existing = await prisma.$queryRawUnsafe(`
      SELECT id FROM "LogframeOutput" WHERE id = $1 AND "tenantId" = $2
    `, outputId, tenantId)
    if (!existing.length) return res.status(404).json({ error: 'Output not found' })

    const rows = await prisma.$queryRawUnsafe(`
      UPDATE "LogframeOutput"
      SET title = COALESCE($3, title),
          description = COALESCE($4, description),
          "updatedAt" = NOW()
      WHERE id = $1 AND "tenantId" = $2
      RETURNING *
    `, outputId, tenantId, title || null, description || null)

    res.json(rows[0])
  } catch (err) {
    console.error('Logframe output update error:', err)
    res.status(500).json({ error: 'Failed to update output' })
  }
})

// ── DELETE /api/ngo/logframe/outputs/:outputId ───────────────
// Delete an output (CASCADE handles indicators)
router.delete('/logframe/outputs/:outputId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { outputId } = req.params

    // Validate belongs to tenant
    const existing = await prisma.$queryRawUnsafe(`
      SELECT id FROM "LogframeOutput" WHERE id = $1 AND "tenantId" = $2
    `, outputId, tenantId)
    if (!existing.length) return res.status(404).json({ error: 'Output not found' })

    await prisma.$executeRawUnsafe(`
      DELETE FROM "LogframeOutput" WHERE id = $1 AND "tenantId" = $2
    `, outputId, tenantId)

    res.json({ success: true })
  } catch (err) {
    console.error('Logframe output delete error:', err)
    res.status(500).json({ error: 'Failed to delete output' })
  }
})

// ── POST /api/ngo/logframe/outputs/:outputId/indicators ──────
// Create an indicator under an output
router.post('/logframe/outputs/:outputId/indicators', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { outputId } = req.params
    const { indicator, baselineValue, targetValue, unit, measurementMethod, reportingPeriod } = req.body

    if (!indicator) return res.status(400).json({ error: 'Indicator name is required' })

    // Validate output belongs to tenant
    const existing = await prisma.$queryRawUnsafe(`
      SELECT id, "projectId" FROM "LogframeOutput" WHERE id = $1 AND "tenantId" = $2
    `, outputId, tenantId)
    if (!existing.length) return res.status(404).json({ error: 'Output not found' })

    const projectId = existing[0].projectId

    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO "LogframeIndicator" (id, "outputId", "projectId", "tenantId", indicator, "baselineValue", "targetValue", unit, "measurementMethod", "reportingPeriod", "ragStatus", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'GREY', NOW(), NOW())
      RETURNING *
    `, outputId, projectId, tenantId, indicator, baselineValue || null, targetValue || null, unit || null, measurementMethod || null, reportingPeriod || null)

    res.status(201).json(rows[0])
  } catch (err) {
    console.error('Logframe indicator create error:', err)
    res.status(500).json({ error: 'Failed to create indicator' })
  }
})

// ── PUT /api/ngo/logframe/indicators/:indicatorId ────────────
// Update an indicator
router.put('/logframe/indicators/:indicatorId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { indicatorId } = req.params
    const { actualValue, ragStatus, notes, indicator, targetValue, unit, measurementMethod, reportingPeriod } = req.body

    // Validate ragStatus if provided
    const validStatuses = ['RED', 'AMBER', 'GREEN', 'GREY']
    if (ragStatus && !validStatuses.includes(ragStatus)) {
      return res.status(400).json({ error: `ragStatus must be one of: ${validStatuses.join(', ')}` })
    }

    // Validate indicator belongs to tenant (via output)
    const existing = await prisma.$queryRawUnsafe(`
      SELECT li.id FROM "LogframeIndicator" li
      JOIN "LogframeOutput" lo ON lo.id = li."outputId"
      WHERE li.id = $1 AND lo."tenantId" = $2
    `, indicatorId, tenantId)
    if (!existing.length) return res.status(404).json({ error: 'Indicator not found' })

    const rows = await prisma.$queryRawUnsafe(`
      UPDATE "LogframeIndicator"
      SET "actualValue" = COALESCE($2, "actualValue"),
          "ragStatus" = COALESCE($3, "ragStatus"),
          notes = COALESCE($4, notes),
          indicator = COALESCE($5, indicator),
          "targetValue" = COALESCE($6, "targetValue"),
          unit = COALESCE($7, unit),
          "measurementMethod" = COALESCE($8, "measurementMethod"),
          "reportingPeriod" = COALESCE($9, "reportingPeriod"),
          "lastUpdatedAt" = NOW(),
          "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *
    `, indicatorId, actualValue || null, ragStatus || null, notes || null, indicator || null, targetValue || null, unit || null, measurementMethod || null, reportingPeriod || null)

    res.json(rows[0])
  } catch (err) {
    console.error('Logframe indicator update error:', err)
    res.status(500).json({ error: 'Failed to update indicator' })
  }
})

// ── DELETE /api/ngo/logframe/indicators/:indicatorId ─────────
// Delete an indicator
router.delete('/logframe/indicators/:indicatorId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId
    const { indicatorId } = req.params

    // Validate indicator belongs to tenant (via output)
    const existing = await prisma.$queryRawUnsafe(`
      SELECT li.id FROM "LogframeIndicator" li
      JOIN "LogframeOutput" lo ON lo.id = li."outputId"
      WHERE li.id = $1 AND lo."tenantId" = $2
    `, indicatorId, tenantId)
    if (!existing.length) return res.status(404).json({ error: 'Indicator not found' })

    await prisma.$executeRawUnsafe(`
      DELETE FROM "LogframeIndicator" WHERE id = $1
    `, indicatorId)

    res.json({ success: true })
  } catch (err) {
    console.error('Logframe indicator delete error:', err)
    res.status(500).json({ error: 'Failed to delete indicator' })
  }
})

module.exports = router
