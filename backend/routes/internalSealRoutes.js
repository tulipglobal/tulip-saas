// ─────────────────────────────────────────────────────────────
//  routes/internalSealRoutes.js — Internal API for cross-app seal creation
//  Secured by INTERNAL_API_SECRET header, no JWT auth required.
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const { createSeal } = require('../lib/unifiedSealEngine')

function internalAuth(req, res, next) {
  const secret = req.headers['x-internal-secret']
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// POST /api/internal/seals/create
router.post('/create', internalAuth, async (req, res) => {
  try {
    const {
      tenantId, documentTitle, documentType,
      issuedTo, issuedBy, rawHash,
      fileKey, fileType, metadata,
      sourceType, fraudContext,
      // OCR + entity fields
      ocrAmount, ocrVendor, ocrDate, ocrConfidence, ocrEngine,
      caseId,
    } = req.body

    if (!tenantId || !rawHash || !documentTitle) {
      return res.status(400).json({ error: 'tenantId, rawHash, and documentTitle are required' })
    }

    const seal = await createSeal({
      tenantId,
      documentTitle,
      documentType: documentType || 'document',
      issuedTo: issuedTo || tenantId,
      issuedBy: issuedBy || 'Tulip Verify',
      rawHash,
      fileKey,
      fileType,
      metadata,
      sourceType: sourceType || 'VERIFY',
      fraudContext,
    })

    // Store OCR + entity fields on the seal if provided
    const extraData = {}
    if (ocrAmount != null) extraData.ocrAmount = parseFloat(ocrAmount)
    if (ocrVendor) extraData.ocrVendor = ocrVendor
    if (ocrDate) extraData.ocrDate = ocrDate
    if (ocrConfidence != null) extraData.ocrConfidence = parseFloat(ocrConfidence)
    if (ocrEngine) extraData.ocrEngine = ocrEngine
    if (caseId) extraData.caseId = caseId
    if (Object.keys(extraData).length > 0) {
      const prisma = require('../lib/client')
      await prisma.trustSeal.update({ where: { id: seal.id }, data: extraData })
    }

    res.json(seal)
  } catch (err) {
    console.error('[internal-seal] create failed:', err)
    res.status(500).json({ error: 'Failed to create seal' })
  }
})

module.exports = router
