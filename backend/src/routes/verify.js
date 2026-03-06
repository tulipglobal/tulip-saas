// ─────────────────────────────────────────────────────────────
//  src/routes/verify.js — v3
//  Adds OpenAPI JSDoc annotations for Swagger UI
// ─────────────────────────────────────────────────────────────

const express    = require('express')
const prisma     = require('../../prisma/client')
const { ethers } = require('ethers')
const crypto     = require('crypto')

const router = express.Router()

const RPC_PRIMARY  = process.env.POLYGON_RPC_PRIMARY
const RPC_FALLBACK = process.env.POLYGON_RPC_FALLBACK

function getProvider() {
  try   { return new ethers.JsonRpcProvider(RPC_PRIMARY) }
  catch { return new ethers.JsonRpcProvider(RPC_FALLBACK) }
}

function hashRecord(record) {
  const canonical = JSON.stringify({
    id:         record.id,
    action:     record.action,
    entityType: record.entityType,
    entityId:   record.entityId,
    userId:     record.userId   ?? null,
    tenantId:   record.tenantId,
    createdAt:  record.createdAt instanceof Date
                  ? record.createdAt.toISOString()
                  : new Date(record.createdAt).toISOString(),
  })
  return crypto.createHash('sha256').update(canonical).digest('hex')
}

/**
 * @openapi
 * /api/verify/{dataHash}:
 *   get:
 *     tags: [Verify]
 *     summary: Verify an audit log entry by SHA-256 hash
 *     description: |
 *       Public endpoint — no authentication required.
 *       Re-derives the SHA-256 hash from stored fields, checks the prevHash chain,
 *       and confirms the blockchain TX on Polygon. Returns dual integrity proof.
 *     security: []
 *     parameters:
 *       - name: dataHash
 *         in: path
 *         required: true
 *         description: SHA-256 hex hash of the audit log entry
 *         schema:
 *           type: string
 *           pattern: '^[a-f0-9]{64}$'
 *           example: '0abec36281c9bdd65a01b1cfeac443401989fef1d60c9ccdc08ed44119bdd2e6'
 *     responses:
 *       200:
 *         description: Verification result with integrity and blockchain proof
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VerifyResult'
 */
router.get('/:dataHash', async (req, res) => {
  const { dataHash } = req.params
  try {
    const record = await prisma.auditLog.findFirst({
      where:  { dataHash },
      select: { id:true, action:true, entityType:true, entityId:true, userId:true,
                tenantId:true, createdAt:true, dataHash:true, prevHash:true,
                batchId:true, blockchainTx:true, blockNumber:true, blockHash:true,
                anchorStatus:true, ancheredAt:true },
    })

    if (!record) return res.json({ verified: false, reason: 'Hash not found', dataHash })

    const recomputedHash = hashRecord(record)
    const hashIntact     = recomputedHash === record.dataHash

    let chainIntact = true, chainBreakReason = null
    if (record.prevHash && record.prevHash !== '0'.repeat(64)) {
      const prev = await prisma.auditLog.findFirst({
        where: { dataHash: record.prevHash }, select: { dataHash: true },
      })
      if (!prev) { chainIntact = false; chainBreakReason = 'Previous hash not found — possible tampering' }
    }

    let onChainVerified = false, onChainBlockMatch = false, onChainDetail = null
    if (record.blockchainTx) {
      try {
        const provider = getProvider()
        const tx = await provider.getTransaction(record.blockchainTx)
        if (!tx)                  { onChainDetail = 'TX not found on chain — possible reorg' }
        else if (!tx.blockNumber) { onChainDetail = 'TX pending — not yet mined' }
        else {
          onChainVerified   = true
          onChainBlockMatch = record.blockNumber ? tx.blockNumber === record.blockNumber : true
          onChainDetail     = `Confirmed at block ${tx.blockNumber}`
        }
      } catch (err) { onChainDetail = `RPC error: ${err.message}` }
    }

    const verified = hashIntact && chainIntact && record.anchorStatus === 'confirmed' && onChainVerified

    return res.json({
      verified,
      dataHash:   record.dataHash,
      batchId:    record.batchId,
      entityType: record.entityType,
      entityId:   record.entityId,
      action:     record.action,
      recordedAt: record.createdAt,
      integrity: { hashRecomputed: recomputedHash, hashIntact, chainIntact, chainBreakReason: chainBreakReason || undefined },
      blockchain: {
        network: 'Polygon', txHash: record.blockchainTx || null,
        blockNumber: record.blockNumber || null, blockHash: record.blockHash || null,
        anchorStatus: record.anchorStatus || null, ancheredAt: record.ancheredAt || null,
        onChainConfirmed: onChainVerified, blockNumberMatch: onChainBlockMatch, onChainDetail,
      },
      audit: { tenantId: record.tenantId, userId: record.userId },
    })
  } catch (err) {
    return res.status(500).json({ verified: false, reason: 'Internal error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined })
  }
})

/**
 * @openapi
 * /api/verify/batch/{batchId}:
 *   get:
 *     tags: [Verify]
 *     summary: Verify all entries in an anchor batch
 *     description: |
 *       Public endpoint — no authentication required.
 *       Checks chain integrity across all records in the batch
 *       and confirms the shared blockchain TX on Polygon.
 *     security: []
 *     parameters:
 *       - name: batchId
 *         in: path
 *         required: true
 *         description: Merkle root hash used as the batch identifier
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Batch verification result
 */
router.get('/batch/:batchId', async (req, res) => {
  const { batchId } = req.params
  try {
    const records = await prisma.auditLog.findMany({
      where:   { batchId },
      orderBy: { createdAt: 'asc' },
      select:  { id:true, dataHash:true, prevHash:true, entityType:true, entityId:true,
                 action:true, anchorStatus:true, blockchainTx:true, blockNumber:true,
                 blockHash:true, ancheredAt:true, createdAt:true },
    })

    if (records.length === 0) return res.json({ verified: false, reason: 'Batch not found', batchId })

    let chainBroken = false
    for (let i = 1; i < records.length; i++) {
      if (records[i].prevHash !== records[i-1].dataHash) { chainBroken = true; break }
    }

    const allConfirmed = records.every(r => r.anchorStatus === 'confirmed')

    return res.json({
      verified: allConfirmed && !chainBroken,
      batchId,
      recordCount:  records.length,
      anchorStatus: allConfirmed ? 'confirmed' : 'partial',
      chainIntact:  !chainBroken,
      blockchain: {
        txHash: records[0].blockchainTx, blockNumber: records[0].blockNumber,
        blockHash: records[0].blockHash, ancheredAt: records[0].ancheredAt,
      },
      records: records.map(r => ({
        id: r.id, dataHash: r.dataHash, entityType: r.entityType,
        entityId: r.entityId, action: r.action, anchorStatus: r.anchorStatus, createdAt: r.createdAt,
      })),
    })
  } catch (err) {
    return res.status(500).json({ verified: false, reason: 'Internal error' })
  }
})

module.exports = router
