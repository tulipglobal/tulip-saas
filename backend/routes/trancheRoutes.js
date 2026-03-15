// ─────────────────────────────────────────────────────────────
//  routes/trancheRoutes.js — Disbursement Tranche routes
//  Donor creates/releases tranches, NGO confirms/utilises
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const prisma = require('../lib/client')
const authenticate = require('../middleware/authenticate')
const tenantScope = require('../middleware/tenantScope')
const { createNotification, notifyDonorOrgsForProject } = require('../services/donorNotificationService')

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
//  DONOR TRANCHE ROUTES
// ═══════════════════════════════════════════════════════════════

// POST /api/tranches/donor/funding/:agreementId
router.post('/donor/funding/:agreementId', donorAuth, async (req, res) => {
  try {
    const { agreementId } = req.params
    const { trancheNumber, amount, currency, releaseConditions, plannedReleaseDate, notes } = req.body

    // Verify donor has access to this agreement
    const agreement = await prisma.fundingAgreement.findFirst({
      where: { id: agreementId, donorOrgId: req.donor.donorOrgId }
    })
    if (!agreement) return res.status(403).json({ error: 'Not your agreement' })

    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO "DisbursementTranche" ("fundingAgreementId", "projectId", "tenantId", "trancheNumber", amount, currency, "releaseConditions", "plannedReleaseDate", notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, agreementId, agreement.projectId || agreement.budgetId, agreement.tenantId,
      trancheNumber || 1, amount, currency || 'USD',
      releaseConditions || null, plannedReleaseDate ? new Date(plannedReleaseDate) : null, notes || null
    )

    res.json({ tranche: rows[0] })
  } catch (err) {
    console.error('Create tranche error:', err)
    res.status(500).json({ error: 'Failed to create tranche' })
  }
})

// GET /api/tranches/donor/funding/:agreementId
router.get('/donor/funding/:agreementId', donorAuth, async (req, res) => {
  try {
    const { agreementId } = req.params
    const tranches = await prisma.$queryRawUnsafe(`
      SELECT * FROM "DisbursementTranche"
      WHERE "fundingAgreementId" = $1
      ORDER BY "trancheNumber" ASC
    `, agreementId)
    res.json({ tranches })
  } catch (err) {
    console.error('Get tranches error:', err)
    res.status(500).json({ error: 'Failed to fetch tranches' })
  }
})

// PUT /api/tranches/donor/:trancheId/release
router.put('/donor/:trancheId/release', donorAuth, async (req, res) => {
  try {
    const { trancheId } = req.params
    const { actualReleaseDate, notes } = req.body

    const rows = await prisma.$queryRawUnsafe(`
      UPDATE "DisbursementTranche"
      SET status = 'RELEASED', "actualReleaseDate" = $1, notes = COALESCE($2, notes), "updatedAt" = NOW()
      WHERE id = $3::uuid
      RETURNING *
    `, actualReleaseDate ? new Date(actualReleaseDate) : new Date(), notes || null, trancheId)

    if (!rows.length) return res.status(404).json({ error: 'Tranche not found' })
    res.json({ tranche: rows[0] })
  } catch (err) {
    console.error('Release tranche error:', err)
    res.status(500).json({ error: 'Failed to release tranche' })
  }
})

// ═══════════════════════════════════════════════════════════════
//  NGO TRANCHE ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/tranches/ngo/funding/:agreementId
router.get('/ngo/funding/:agreementId', authenticate, tenantScope, async (req, res) => {
  try {
    const { agreementId } = req.params
    const tranches = await prisma.$queryRawUnsafe(`
      SELECT * FROM "DisbursementTranche"
      WHERE "fundingAgreementId" = $1 AND "tenantId" = $2
      ORDER BY "trancheNumber" ASC
    `, agreementId, req.user.tenantId)
    res.json({ tranches })
  } catch (err) {
    console.error('NGO get tranches error:', err)
    res.status(500).json({ error: 'Failed to fetch tranches' })
  }
})

// PUT /api/tranches/ngo/:trancheId/conditions-met
router.put('/ngo/:trancheId/conditions-met', authenticate, tenantScope, async (req, res) => {
  try {
    const { trancheId } = req.params
    const { notes } = req.body

    const rows = await prisma.$queryRawUnsafe(`
      UPDATE "DisbursementTranche"
      SET status = 'CONDITIONS_MET', "conditionsMetAt" = NOW(), "conditionsMetBy" = $1, notes = COALESCE($2, notes), "updatedAt" = NOW()
      WHERE id = $3::uuid AND "tenantId" = $4
      RETURNING *
    `, req.user.userId || req.user.id, notes || null, trancheId, req.user.tenantId)

    if (!rows.length) return res.status(404).json({ error: 'Tranche not found' })

    // Notify donor
    const tranche = rows[0]
    const agreement = await prisma.fundingAgreement.findFirst({ where: { id: tranche.fundingAgreementId }, select: { donorOrgId: true, title: true } })
    if (agreement?.donorOrgId) {
      createNotification({
        donorOrgId: agreement.donorOrgId,
        alertType: 'funding.conditions_met',
        title: `Tranche #${tranche.trancheNumber} conditions met`,
        body: `NGO has confirmed conditions are met for tranche #${tranche.trancheNumber} of ${agreement.title}`,
        entityType: 'DisbursementTranche',
        entityId: tranche.id
      }).catch(() => {})
    }

    res.json({ tranche: rows[0] })
  } catch (err) {
    console.error('NGO conditions-met error:', err)
    res.status(500).json({ error: 'Failed to update tranche' })
  }
})

// PUT /api/tranches/ngo/:trancheId/utilisation
router.put('/ngo/:trancheId/utilisation', authenticate, tenantScope, async (req, res) => {
  try {
    const { trancheId } = req.params
    const { utilisedAmount } = req.body

    // Get current tranche to check amount
    const current = await prisma.$queryRawUnsafe(
      `SELECT * FROM "DisbursementTranche" WHERE id = $1::uuid AND "tenantId" = $2`, trancheId, req.user.tenantId
    )
    if (!current.length) return res.status(404).json({ error: 'Tranche not found' })

    const newStatus = parseFloat(utilisedAmount) >= parseFloat(current[0].amount) ? 'UTILISED' : current[0].status

    const rows = await prisma.$queryRawUnsafe(`
      UPDATE "DisbursementTranche"
      SET "utilisedAmount" = $1, status = $2, "updatedAt" = NOW()
      WHERE id = $3::uuid AND "tenantId" = $4
      RETURNING *
    `, utilisedAmount, newStatus, trancheId, req.user.tenantId)

    res.json({ tranche: rows[0] })
  } catch (err) {
    console.error('NGO utilisation error:', err)
    res.status(500).json({ error: 'Failed to update utilisation' })
  }
})

module.exports = router
