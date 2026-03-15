// ─────────────────────────────────────────────────────────────
//  routes/wbRoutes.js — World Bank Data Routes
// ─────────────────────────────────────────────────────────────
const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')

router.use(authenticate, tenantScope)

// GET /api/ngo/projects/:projectId/wb-components
router.get('/projects/:projectId/wb-components', async (req, res) => {
  try {
    const { projectId } = req.params
    const tenantId = req.user.tenantId
    const components = await prisma.$queryRawUnsafe(
      `SELECT * FROM "WBProjectComponent" WHERE "projectId" = $1 AND "tenantId" = $2 ORDER BY "createdAt"`,
      projectId, tenantId
    )
    res.json({ components })
  } catch (err) {
    console.error('Get WB components error:', err)
    res.status(500).json({ error: 'Failed to fetch components' })
  }
})

// POST /api/ngo/projects/:projectId/wb-components
router.post('/projects/:projectId/wb-components', async (req, res) => {
  try {
    const { projectId } = req.params
    const tenantId = req.user.tenantId
    const { name, wbBudget, govBudget, currency } = req.body
    if (!name) return res.status(400).json({ error: 'Name is required' })
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO "WBProjectComponent" ("projectId", "tenantId", name, "wbBudget", "govBudget", currency)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      projectId, tenantId, name, wbBudget || 0, govBudget || 0, currency || 'USD'
    )
    res.json({ component: result[0] })
  } catch (err) {
    console.error('Create WB component error:', err)
    res.status(500).json({ error: 'Failed to create component' })
  }
})

// PUT /api/ngo/wb-components/:componentId
router.put('/wb-components/:componentId', async (req, res) => {
  try {
    const { componentId } = req.params
    const tenantId = req.user.tenantId
    const { name, wbBudget, govBudget, actualThisPeriod, cumulativeActual } = req.body
    const result = await prisma.$queryRawUnsafe(
      `UPDATE "WBProjectComponent" SET
        name = COALESCE($1, name),
        "wbBudget" = COALESCE($2, "wbBudget"),
        "govBudget" = COALESCE($3, "govBudget"),
        "actualThisPeriod" = COALESCE($4, "actualThisPeriod"),
        "cumulativeActual" = COALESCE($5, "cumulativeActual"),
        "updatedAt" = NOW()
      WHERE id = $6 AND "tenantId" = $7 RETURNING *`,
      name || null, wbBudget != null ? wbBudget : null, govBudget != null ? govBudget : null,
      actualThisPeriod != null ? actualThisPeriod : null, cumulativeActual != null ? cumulativeActual : null,
      componentId, tenantId
    )
    if (!result.length) return res.status(404).json({ error: 'Component not found' })
    res.json({ component: result[0] })
  } catch (err) {
    console.error('Update WB component error:', err)
    res.status(500).json({ error: 'Failed to update component' })
  }
})

// DELETE /api/ngo/wb-components/:componentId
router.delete('/wb-components/:componentId', async (req, res) => {
  try {
    const { componentId } = req.params
    const tenantId = req.user.tenantId
    await prisma.$executeRawUnsafe(
      `DELETE FROM "WBProjectComponent" WHERE id = $1 AND "tenantId" = $2`,
      componentId, tenantId
    )
    res.json({ deleted: true })
  } catch (err) {
    console.error('Delete WB component error:', err)
    res.status(500).json({ error: 'Failed to delete component' })
  }
})

// GET /api/ngo/projects/:projectId/wb-contracts
router.get('/projects/:projectId/wb-contracts', async (req, res) => {
  try {
    const { projectId } = req.params
    const tenantId = req.user.tenantId
    const contracts = await prisma.$queryRawUnsafe(
      `SELECT * FROM "WBProcurementContract" WHERE "projectId" = $1 AND "tenantId" = $2 ORDER BY "createdAt"`,
      projectId, tenantId
    )
    res.json({ contracts })
  } catch (err) {
    console.error('Get WB contracts error:', err)
    res.status(500).json({ error: 'Failed to fetch contracts' })
  }
})

// POST /api/ngo/projects/:projectId/wb-contracts
router.post('/projects/:projectId/wb-contracts', async (req, res) => {
  try {
    const { projectId } = req.params
    const tenantId = req.user.tenantId
    const { description, procurementMethod, estimatedCost, currency, contractDate, notes } = req.body
    if (!description || !procurementMethod || estimatedCost == null) {
      return res.status(400).json({ error: 'description, procurementMethod, and estimatedCost are required' })
    }
    const validMethods = ['ICB', 'NCB', 'SHOPPING', 'DIRECT', 'CQS', 'QCBS']
    if (!validMethods.includes(procurementMethod)) {
      return res.status(400).json({ error: `Invalid procurement method. Must be one of: ${validMethods.join(', ')}` })
    }
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO "WBProcurementContract" ("projectId", "tenantId", description, "procurementMethod", "estimatedCost", currency, "contractDate", notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      projectId, tenantId, description, procurementMethod, estimatedCost, currency || 'USD',
      contractDate ? new Date(contractDate) : null, notes || null
    )
    res.json({ contract: result[0] })
  } catch (err) {
    console.error('Create WB contract error:', err)
    res.status(500).json({ error: 'Failed to create contract' })
  }
})

// PUT /api/ngo/wb-contracts/:contractId
router.put('/wb-contracts/:contractId', async (req, res) => {
  try {
    const { contractId } = req.params
    const tenantId = req.user.tenantId
    const { actualCost, status, completionDate, notes } = req.body
    const validStatuses = ['PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED']
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
    }
    const result = await prisma.$queryRawUnsafe(
      `UPDATE "WBProcurementContract" SET
        "actualCost" = COALESCE($1, "actualCost"),
        status = COALESCE($2, status),
        "completionDate" = COALESCE($3, "completionDate"),
        notes = COALESCE($4, notes),
        "updatedAt" = NOW()
      WHERE id = $5 AND "tenantId" = $6 RETURNING *`,
      actualCost != null ? actualCost : null, status || null,
      completionDate ? new Date(completionDate) : null, notes || null,
      contractId, tenantId
    )
    if (!result.length) return res.status(404).json({ error: 'Contract not found' })
    res.json({ contract: result[0] })
  } catch (err) {
    console.error('Update WB contract error:', err)
    res.status(500).json({ error: 'Failed to update contract' })
  }
})

// DELETE /api/ngo/wb-contracts/:contractId
router.delete('/wb-contracts/:contractId', async (req, res) => {
  try {
    const { contractId } = req.params
    const tenantId = req.user.tenantId
    await prisma.$executeRawUnsafe(
      `DELETE FROM "WBProcurementContract" WHERE id = $1 AND "tenantId" = $2`,
      contractId, tenantId
    )
    res.json({ deleted: true })
  } catch (err) {
    console.error('Delete WB contract error:', err)
    res.status(500).json({ error: 'Failed to delete contract' })
  }
})

module.exports = router
