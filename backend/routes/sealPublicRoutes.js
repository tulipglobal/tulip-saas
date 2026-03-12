// ─────────────────────────────────────────────────────────────
//  routes/sealPublicRoutes.js — Public seal verification (no auth)
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const { getPresignedUrlFromKey } = require('../lib/s3Upload')

// GET /api/public/seal/case/:caseId — all seals for a case (for tulip-verify)
router.get('/case/:caseId', async (req, res) => {
  try {
    const seals = await prisma.trustSeal.findMany({
      where: {
        metadata: { path: ['caseId'], equals: req.params.caseId },
      },
      orderBy: { createdAt: 'asc' },
    })

    res.json(seals.map(s => ({
      id: s.id,
      documentTitle: s.documentTitle,
      documentType: s.documentType,
      rawHash: s.rawHash,
      status: s.status,
      anchorTxHash: s.anchorTxHash,
      anchoredAt: s.anchoredAt,
      blockNumber: s.blockNumber,
      metadata: s.metadata,
      createdAt: s.createdAt,
    })))
  } catch (err) {
    console.error('Failed to fetch case seals:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// GET /api/public/seal/:id — public seal verification
router.get('/:id', async (req, res) => {
  try {
    const seal = await prisma.trustSeal.findUnique({
      where: { id: req.params.id },
      include: {
        tenant: { select: { name: true, tenantType: true, logoUrl: true, country: true } },
      },
    })

    if (!seal) {
      return res.status(404).json({ verified: false, error: 'Seal not found' })
    }

    res.json({
      verified: true,
      id: seal.id,
      documentTitle: seal.documentTitle,
      documentType: seal.documentType,
      issuedTo: seal.issuedTo,
      issuedToEmail: seal.issuedToEmail,
      issuedBy: seal.issuedBy,
      metadata: seal.metadata,
      rawHash: seal.rawHash,
      hasDocument: !!seal.s3Key,
      fileType: seal.fileType || null,
      status: seal.status,
      issuedAt: seal.createdAt,
      qrCodeUrl: seal.qrCodeUrl,
      blockchain: {
        network: 'Polygon',
        txHash: seal.anchorTxHash || null,
        blockNumber: seal.blockNumber || null,
        anchorStatus: seal.anchorTxHash ? 'confirmed' : 'pending',
        anchoredAt: seal.anchoredAt || null,
      },
      issuer: {
        name: seal.tenant.name,
        type: seal.tenant.tenantType,
        logoUrl: seal.tenant.logoUrl,
        country: seal.tenant.country,
      },
      fraudRisk: seal.fraudRiskScore != null ? {
        score: seal.fraudRiskScore,
        level: seal.fraudRiskLevel,
        signals: seal.fraudSignals || [],
      } : null,
      sourceType: seal.sourceType || null,
    })
  } catch (err) {
    console.error('Failed to verify seal:', err)
    res.status(500).json({ verified: false, error: 'Internal error' })
  }
})

// GET /api/public/seal/:id/document — presigned URL for seal file
router.get('/:id/document', async (req, res) => {
  try {
    const seal = await prisma.trustSeal.findUnique({
      where: { id: req.params.id },
      select: { s3Key: true, fileType: true, documentTitle: true },
    })
    if (!seal || !seal.s3Key) return res.status(404).json({ error: 'Document not found' })

    const url = await getPresignedUrlFromKey(seal.s3Key, 3600, {
      contentType: seal.fileType || 'application/octet-stream',
    })
    if (!url) return res.status(500).json({ error: 'Could not generate URL' })

    res.json({ url, fileType: seal.fileType, name: seal.documentTitle, expiresIn: 3600 })
  } catch (err) {
    console.error('Failed to get seal document:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

module.exports = router
