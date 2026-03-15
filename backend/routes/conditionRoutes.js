// ─────────────────────────────────────────────────────────────
//  routes/conditionRoutes.js — Grant Condition routes
//  Donor creates/waives conditions, NGO marks met/breached
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')
const { createNotification } = require('../services/donorNotificationService')

const JWT_SECRET = process.env.JWT_SECRET

function donorAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET)
    if (!payload.donorOrgId) return res.status(401).json({ error: 'Not a donor token' })
    req.donor = payload
    next()
  } catch { return res.status(401).json({ error: 'Invalid token' }) }
}

// ═══════════════════════════════════════════════════════════════
//  DONOR CONDITION ROUTES
// ═══════════════════════════════════════════════════════════════

// POST /api/conditions/donor/funding/:agreementId
router.post('/donor/funding/:agreementId', donorAuth, async (req, res) => {
  try {
    const { agreementId } = req.params
    const { title, description, conditionType } = req.body

    if (!title) return res.status(400).json({ error: 'Title is required' })

    const agreement = await prisma.fundingAgreement.findFirst({
      where: { id: agreementId, donorOrgId: req.donor.donorOrgId }
    })
    if (!agreement) return res.status(403).json({ error: 'Not your agreement' })

    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO "GrantCondition" ("fundingAgreementId", "projectId", "tenantId", "donorOrgId", title, description, "conditionType")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, agreementId, agreement.projectId || agreement.budgetId, agreement.tenantId,
      req.donor.donorOrgId, title, description || null, conditionType || 'MANUAL'
    )

    res.json({ condition: rows[0] })
  } catch (err) {
    console.error('Create condition error:', err)
    res.status(500).json({ error: 'Failed to create condition' })
  }
})

// GET /api/conditions/donor/funding/:agreementId
router.get('/donor/funding/:agreementId', donorAuth, async (req, res) => {
  try {
    const { agreementId } = req.params
    const conditions = await prisma.$queryRawUnsafe(`
      SELECT * FROM "GrantCondition"
      WHERE "fundingAgreementId" = $1 AND "donorOrgId" = $2
      ORDER BY "createdAt" ASC
    `, agreementId, req.donor.donorOrgId)
    res.json({ conditions })
  } catch (err) {
    console.error('Get conditions error:', err)
    res.status(500).json({ error: 'Failed to fetch conditions' })
  }
})

// PUT /api/conditions/donor/:conditionId/waive
router.put('/donor/:conditionId/waive', donorAuth, async (req, res) => {
  try {
    const { conditionId } = req.params
    const { reason } = req.body

    const rows = await prisma.$queryRawUnsafe(`
      UPDATE "GrantCondition"
      SET status = 'WAIVED', "breachNote" = $1, "checkedAt" = NOW(), "updatedAt" = NOW()
      WHERE id = $2::uuid AND "donorOrgId" = $3
      RETURNING *
    `, reason || 'Waived by donor', conditionId, req.donor.donorOrgId)

    if (!rows.length) return res.status(404).json({ error: 'Condition not found' })
    res.json({ condition: rows[0] })
  } catch (err) {
    console.error('Waive condition error:', err)
    res.status(500).json({ error: 'Failed to waive condition' })
  }
})

// ═══════════════════════════════════════════════════════════════
//  NGO CONDITION ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/conditions/ngo/funding/:agreementId
router.get('/ngo/funding/:agreementId', authenticate, tenantScope, async (req, res) => {
  try {
    const { agreementId } = req.params
    const conditions = await prisma.$queryRawUnsafe(`
      SELECT * FROM "GrantCondition"
      WHERE "fundingAgreementId" = $1 AND "tenantId" = $2
      ORDER BY "createdAt" ASC
    `, agreementId, req.user.tenantId)
    res.json({ conditions })
  } catch (err) {
    console.error('NGO get conditions error:', err)
    res.status(500).json({ error: 'Failed to fetch conditions' })
  }
})

// PUT /api/conditions/ngo/:conditionId/status
router.put('/ngo/:conditionId/status', authenticate, tenantScope, async (req, res) => {
  try {
    const { conditionId } = req.params
    const { status, note } = req.body

    if (!['MET', 'BREACHED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be MET or BREACHED' })
    }

    const updates = status === 'MET'
      ? `status = 'MET', "metAt" = NOW(), "checkedAt" = NOW()`
      : `status = 'BREACHED', "breachNote" = $1, "checkedAt" = NOW()`

    let rows
    if (status === 'BREACHED') {
      rows = await prisma.$queryRawUnsafe(`
        UPDATE "GrantCondition"
        SET status = 'BREACHED', "breachNote" = $1, "checkedAt" = NOW(), "updatedAt" = NOW()
        WHERE id = $2::uuid AND "tenantId" = $3
        RETURNING *
      `, note || null, conditionId, req.user.tenantId)
    } else {
      rows = await prisma.$queryRawUnsafe(`
        UPDATE "GrantCondition"
        SET status = 'MET', "metAt" = NOW(), "checkedAt" = NOW(), "updatedAt" = NOW()
        WHERE id = $1::uuid AND "tenantId" = $2
        RETURNING *
      `, conditionId, req.user.tenantId)
    }

    if (!rows.length) return res.status(404).json({ error: 'Condition not found' })

    // If breached, notify donor
    if (status === 'BREACHED') {
      const condition = rows[0]
      createNotification({
        donorOrgId: condition.donorOrgId,
        alertType: 'funding.condition_breached',
        title: `Condition breached: ${condition.title}`,
        body: note || 'A grant condition has been reported as breached',
        entityType: 'GrantCondition',
        entityId: condition.id,
        projectId: condition.projectId
      }).catch(() => {})
    }

    res.json({ condition: rows[0] })
  } catch (err) {
    console.error('NGO update condition error:', err)
    res.status(500).json({ error: 'Failed to update condition' })
  }
})

// GET /api/conditions/ngo/project/:projectId — all conditions for a project
router.get('/ngo/project/:projectId', authenticate, tenantScope, async (req, res) => {
  try {
    const conditions = await prisma.$queryRawUnsafe(`
      SELECT gc.*, fa.title as "agreementTitle"
      FROM "GrantCondition" gc
      LEFT JOIN "FundingAgreement" fa ON fa.id = gc."fundingAgreementId"
      WHERE gc."projectId" = $1 AND gc."tenantId" = $2
      ORDER BY gc."createdAt" ASC
    `, req.params.projectId, req.user.tenantId)
    res.json({ conditions })
  } catch (err) {
    console.error('NGO get project conditions error:', err)
    res.status(500).json({ error: 'Failed to fetch conditions' })
  }
})

// GET /api/conditions/donor/project/:projectId — all conditions for a project
router.get('/donor/project/:projectId', donorAuth, async (req, res) => {
  try {
    const conditions = await prisma.$queryRawUnsafe(`
      SELECT gc.*, fa.title as "agreementTitle"
      FROM "GrantCondition" gc
      LEFT JOIN "FundingAgreement" fa ON fa.id = gc."fundingAgreementId"
      WHERE gc."projectId" = $1 AND gc."donorOrgId" = $2
      ORDER BY gc."createdAt" ASC
    `, req.params.projectId, req.donor.donorOrgId)
    res.json({ conditions })
  } catch (err) {
    console.error('Donor get project conditions error:', err)
    res.status(500).json({ error: 'Failed to fetch conditions' })
  }
})

module.exports = router
