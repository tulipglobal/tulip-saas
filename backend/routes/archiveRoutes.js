// ─────────────────────────────────────────────────────────────
//  routes/archiveRoutes.js — v1
//
//  Register in app.js:
//    app.use('/api/archives', authenticate, tenantScope, archiveRoutes)
//
//  Endpoints:
//    GET /api/archives/:batchId        — retrieve archived batch from S3
//    GET /api/archives                 — list recent confirmed batches
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router  = express.Router()
const { can } = require('../middleware/permission')
const prisma  = require('../lib/client')
const { retrieveArchive, buildS3Key } = require('../services/archiveService')

// ── List recent confirmed batches ─────────────────────────────
router.get('/', can('audit:read'), async (req, res) => {
  try {
    const batches = await prisma.auditLog.findMany({
      where: {
        tenantId:     req.tenantId,
        anchorStatus: 'confirmed',
        batchId:      { not: null },
      },
      distinct: ['batchId'],
      orderBy:  { ancheredAt: 'desc' },
      take:     50,
      select: {
        batchId:      true,
        blockchainTx: true,
        blockNumber:  true,
        ancheredAt:   true,
        tenantId:     true,
        createdAt:    true,
      }
    })

    const results = batches.map(b => ({
      batchId:     b.batchId,
      txHash:      b.blockchainTx,
      blockNumber: b.blockNumber,
      ancheredAt:  b.ancheredAt,
      s3Key:       b.ancheredAt
        ? buildS3Key(b.tenantId, b.batchId, b.ancheredAt)
        : null,
    }))

    res.json(results)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Retrieve a specific batch archive from S3 ─────────────────
router.get('/:batchId', can('audit:read'), async (req, res) => {
  try {
    const { batchId } = req.params

    // Find the batch anchor record to get ancheredAt for path building
    const record = await prisma.auditLog.findFirst({
      where: { batchId, tenantId: req.tenantId, anchorStatus: 'confirmed' },
      select: { ancheredAt: true, tenantId: true }
    })

    if (!record) {
      return res.status(404).json({ error: 'Batch not found or not yet confirmed' })
    }

    const archive = await retrieveArchive(
      record.tenantId,
      batchId,
      record.ancheredAt
    )

    res.json(archive)
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      return res.status(404).json({ error: 'Archive not found in S3 — may not have been archived yet' })
    }
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
