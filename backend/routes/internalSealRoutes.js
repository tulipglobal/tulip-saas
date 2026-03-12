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

    res.json(seal)
  } catch (err) {
    console.error('[internal-seal] create failed:', err)
    res.status(500).json({ error: 'Failed to create seal' })
  }
})

module.exports = router
