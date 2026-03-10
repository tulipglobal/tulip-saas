// ─────────────────────────────────────────────────────────────
//  routes/sealPublicRoutes.js — Public seal verification (no auth)
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')

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
    })
  } catch (err) {
    console.error('Failed to verify seal:', err)
    res.status(500).json({ verified: false, error: 'Internal error' })
  }
})

module.exports = router
