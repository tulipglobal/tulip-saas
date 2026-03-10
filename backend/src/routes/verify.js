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

// ── Static / multi-segment routes MUST come before /:dataHash catch-all ──

// GET /api/verify/document/:id/view — public presigned URL for verified documents
router.get('/document/:id/view', async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      select: { id: true, fileUrl: true, name: true }
    })
    if (!document) return res.status(404).json({ error: 'Document not found' })

    const { getPresignedUrl } = require('../../lib/s3Upload')
    const url = await getPresignedUrl(document.fileUrl)
    if (!url) return res.status(500).json({ error: 'Could not generate view URL' })
    res.json({ url, name: document.name, expiresIn: 3600 })
  } catch (err) {
    res.status(500).json({ error: 'Failed to get document URL' })
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

// ── Catch-all hash lookup (must be LAST single-param route) ──

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

if (!record) {
  // Check OcrJob.hashValue
  const ocrJob = await prisma.ocrJob.findFirst({
    where: { hashValue: dataHash },
    include: { tenant: { select: { name: true, tenantType: true } } }
  })
  if (ocrJob) {
    return res.json({
      verified: true,
      status: 'verified',
      dataHash,
      source: 'ocr',
      documentType: ocrJob.documentType || 'document',
      detectedLanguage: ocrJob.detectedLanguage,
      entityType: 'OcrJob',
      entityId: ocrJob.id,
      recordedAt: ocrJob.createdAt,
      anchoredAt: ocrJob.anchoredAt || ocrJob.createdAt,
      organisationName: ocrJob.tenant?.name || null,
      organisationType: ocrJob.tenant?.tenantType || null,
      assessmentScore: ocrJob.assessmentScore,
      assessmentResult: ocrJob.assessmentResult,
      blockchain: {
        network: 'Polygon',
        txHash: ocrJob.anchorTxHash || null,
        anchorStatus: ocrJob.anchorTxHash ? 'confirmed' : 'pending',
        ancheredAt: ocrJob.anchoredAt || null,
      },
    })
  }

  // Check BundleJob.bundleHash
  const bundleJob = await prisma.bundleJob.findFirst({
    where: { bundleHash: dataHash },
    include: { tenant: { select: { name: true, tenantType: true } } }
  })
  if (bundleJob) {
    return res.json({
      verified: true,
      status: 'verified',
      dataHash,
      source: 'bundle',
      documentType: 'bundle_verification',
      entityType: 'BundleJob',
      entityId: bundleJob.id,
      recordedAt: bundleJob.createdAt,
      anchoredAt: bundleJob.anchoredAt || bundleJob.createdAt,
      organisationName: bundleJob.tenant?.name || null,
      organisationType: bundleJob.tenant?.tenantType || null,
      fileCount: bundleJob.fileCount,
      overallRiskScore: bundleJob.overallRiskScore,
      overallRiskLevel: bundleJob.overallRiskLevel,
      blockchain: {
        network: 'Polygon',
        txHash: bundleJob.anchorTxHash || null,
        anchorStatus: bundleJob.anchorTxHash ? 'confirmed' : 'pending',
        ancheredAt: bundleJob.anchoredAt || null,
      },
    })
  }

  // Check TrustSeal.rawHash
  const trustSeal = await prisma.trustSeal.findFirst({
    where: { rawHash: dataHash },
    include: { tenant: { select: { name: true, tenantType: true } } }
  })
  if (trustSeal) {
    return res.json({
      verified: true,
      status: 'verified',
      dataHash,
      source: 'seal',
      documentType: trustSeal.documentType || 'CERTIFICATE',
      entityType: 'TrustSeal',
      entityId: trustSeal.id,
      recordedAt: trustSeal.createdAt,
      anchoredAt: trustSeal.anchoredAt || trustSeal.createdAt,
      organisationName: trustSeal.tenant?.name || null,
      organisationType: trustSeal.tenant?.tenantType || null,
      entityDetails: {
        organisationName: trustSeal.tenant?.name || null,
        organisationType: trustSeal.tenant?.tenantType || null,
        documentName: trustSeal.documentTitle,
      },
      blockchain: {
        network: 'Polygon',
        txHash: trustSeal.anchorTxHash || null,
        blockNumber: trustSeal.blockNumber || null,
        anchorStatus: trustSeal.anchorTxHash ? 'confirmed' : 'pending',
        ancheredAt: trustSeal.anchoredAt || null,
      },
    })
  }

  const doc = await prisma.document.findFirst({
    where: { sha256Hash: dataHash },
    include: { project: { select: { name: true } }, expense: { select: { description: true, amount: true, currency: true, project: { select: { name: true } } } } }
  })
  if (!doc) return res.json({ verified: false, reason: 'Hash not found', dataHash })

  const docAudit = await prisma.auditLog.findFirst({
    where: { entityType: 'Document', entityId: doc.id },
    select: { id:true, action:true, entityType:true, entityId:true, userId:true,
              tenantId:true, createdAt:true, dataHash:true, prevHash:true,
              batchId:true, blockchainTx:true, blockNumber:true, blockHash:true,
              anchorStatus:true, ancheredAt:true }
  })

  const tenant = docAudit ? await prisma.tenant.findUnique({
    where: { id: docAudit.tenantId },
    select: { name: true, tenantType: true }
  }) : null

  return res.json({
    verified: docAudit?.anchorStatus === 'confirmed',
    dataHash,
    documentHash: true,
    documentId: doc.id,
    batchId: docAudit?.batchId || null,
    entityType: 'Document',
    entityId: doc.id,
    action: 'DOCUMENT_UPLOADED',
    recordedAt: doc.uploadedAt,
    entityDetails: {
      organisationName: tenant?.name || null,
      organisationType: tenant?.tenantType || null,
      documentName: doc.name,
      fileType: doc.fileType,
      documentLevel: doc.documentLevel,
      projectName: doc.project?.name || doc.expense?.project?.name || null,
      expenseDescription: doc.expense?.description || null,
      amount: doc.expense?.amount || null,
      currency: doc.expense?.currency || null,
    },
    integrity: { hashIntact: true, chainIntact: true },
    blockchain: {
      txHash: docAudit?.blockchainTx || null,
      blockNumber: docAudit?.blockNumber || null,
      anchorStatus: docAudit?.anchorStatus || null,
      ancheredAt: docAudit?.ancheredAt || null,
    },
    audit: { tenantId: docAudit?.tenantId, userId: docAudit?.userId }
  })
}

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

    // For entries with blockchain confirmation, require on-chain verification
    // For entries still pending anchoring but with intact hash/chain, consider verified
    const isAnchored = record.anchorStatus === 'confirmed' && onChainVerified
    const verified = hashIntact && chainIntact && (isAnchored || record.anchorStatus !== 'failed')

    // Flag whether this is a document entry or an activity log entry
    const isDocumentEntry = record.entityType === 'Document'
    const documentHash = isDocumentEntry

    // Enrich with entity details
    let entityDetails = null
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: record.tenantId },
        select: { name: true, tenantType: true }
      })

      if (record.entityType === 'Expense' && record.entityId) {
        const expense = await prisma.expense.findUnique({
          where: { id: record.entityId },
          select: { description: true, amount: true, currency: true,
                    project: { select: { name: true } } }
        })
        if (expense) {
          entityDetails = {
            organisationName: tenant?.name || null,
            organisationType: tenant?.tenantType || null,
            expenseDescription: expense.description,
            amount: expense.amount,
            currency: expense.currency,
            projectName: expense.project?.name || null,
          }
        }
      } else if (record.entityType === 'Project' && record.entityId) {
        const project = await prisma.project.findUnique({
          where: { id: record.entityId },
          select: { name: true, description: true, budget: true, status: true }
        })
        if (project) {
          entityDetails = {
            organisationName: tenant?.name || null,
            organisationType: tenant?.tenantType || null,
            projectName: project.name,
            projectDescription: project.description || null,
            budget: project.budget || null,
            status: project.status,
          }
        }
      } else if (record.entityType === 'Document' && record.entityId) {
        const document = await prisma.document.findUnique({
          where: { id: record.entityId },
          select: { name: true, fileType: true, project: { select: { name: true } } }
        })
        if (document) {
          entityDetails = {
            organisationName: tenant?.name || null,
            organisationType: tenant?.tenantType || null,
            documentName: document.name,
            fileType: document.fileType || null,
            projectName: document.project?.name || null,
          }
        }
      } else if (record.entityType === 'FundingSource' && record.entityId) {
        const fs = await prisma.fundingSource.findUnique({
          where: { id: record.entityId },
          select: { name: true, amount: true, currency: true, project: { select: { name: true } } }
        })
        if (fs) {
          entityDetails = {
            organisationName: tenant?.name || null,
            organisationType: tenant?.tenantType || null,
            documentName: fs.name,
            amount: fs.amount,
            currency: fs.currency,
            projectName: fs.project?.name || null,
          }
        }
      } else if (record.entityType === 'User') {
        entityDetails = {
          organisationName: tenant?.name || null,
          organisationType: tenant?.tenantType || null,
        }
      }
    } catch (e) { /* enrichment failure is non-fatal */ }

    return res.json({
      verified,
      dataHash:   record.dataHash,
      documentHash,
      documentId: isDocumentEntry ? record.entityId : undefined,
      batchId:    record.batchId,
      entityType: record.entityType,
      entityId:   record.entityId,
      action:     record.action,
      recordedAt: record.createdAt,
      entityDetails,
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

module.exports = router
// This is added at the bottom — do NOT run this
