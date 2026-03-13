// ─────────────────────────────────────────────────────────────
//  services/batchAnchorService.js — v4
//
//  Changes from v3:
//  ✔ Archives confirmed batch to S3 after blockchain confirmation
//  ✔ SIEM events for anchor.confirmed and anchor.failed
// ─────────────────────────────────────────────────────────────

const { ethers } = require('ethers')
const crypto      = require('crypto')
const prisma      = require('../lib/client')
const { buildMerkleRoot }  = require('../lib/merkle')
const { dispatch }         = require('./webhookService')
const { emit: siemEmit }   = require('./siemService')
const { archiveBatch }     = require('./archiveService')
const logger               = require('../lib/logger')
const { notifyDocumentAnchored } = require('./emailNotificationService')

function getProvider() {
  try   { return new ethers.JsonRpcProvider(process.env.POLYGON_RPC_PRIMARY || process.env.RPC_URL) }
  catch { return new ethers.JsonRpcProvider(process.env.POLYGON_RPC_FALLBACK) }
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

async function buildHashChain(records, tenantId) {
  const last = await prisma.auditLog.findFirst({
    where:   { tenantId, prevHash: { not: null } },
    orderBy: { createdAt: 'desc' },
    select:  { dataHash: true },
  })

  let previousHash = last?.dataHash || '0'.repeat(64)
  const updates = []
  for (const record of records) {
    const dataHash = hashRecord(record)
    updates.push({ id: record.id, dataHash, prevHash: previousHash })
    previousHash = dataHash
  }
  return updates
}

async function anchorBatch() {
  // ── 1. Gather all pending items ─────────────────────────────
  const logs = await prisma.auditLog.findMany({
    where:   { blockchainTx: null },
    take:    20,
    orderBy: { createdAt: 'asc' },
  })

  const pendingOcrJobs = await prisma.ocrJob.findMany({
    where: { status: 'completed', hashValue: { not: null }, anchorTxHash: null },
    take: 20,
    orderBy: { createdAt: 'asc' },
    select: { id: true, hashValue: true, tenantId: true },
  })

  const pendingBundleJobs = await prisma.bundleJob.findMany({
    where: { status: 'completed', bundleHash: { not: null }, anchorTxHash: null },
    take: 20,
    orderBy: { createdAt: 'asc' },
    select: { id: true, bundleHash: true, tenantId: true },
  })

  const pendingSeals = await prisma.trustSeal.findMany({
    where: { anchorTxHash: null, rawHash: { not: '' } },
    take: 20,
    orderBy: { createdAt: 'asc' },
    select: { id: true, rawHash: true, tenantId: true },
  })

  const totalPending = logs.length + pendingOcrJobs.length + pendingBundleJobs.length + pendingSeals.length
  if (totalPending === 0) { logger.info('No items to anchor'); return }
  logger.info(`Anchoring ${logs.length} log(s), ${pendingOcrJobs.length} OCR job(s), ${pendingBundleJobs.length} bundle(s), ${pendingSeals.length} seal(s)...`)

  // ── 2. Build hash chain for audit logs ──────────────────────
  const byTenant = logs.reduce((acc, l) => {
    if (!acc[l.tenantId]) acc[l.tenantId] = []
    acc[l.tenantId].push(l)
    return acc
  }, {})

  const allChainUpdates = []
  for (const [tenantId, tenantLogs] of Object.entries(byTenant)) {
    const updates = await buildHashChain(tenantLogs, tenantId)
    allChainUpdates.push(...updates)
  }

  // ── 3. Build combined Merkle root from ALL hashes ───────────
  const hashes = [
    ...allChainUpdates.map(u => u.dataHash),
    ...pendingOcrJobs.map(j => j.hashValue),
    ...pendingBundleJobs.map(b => b.bundleHash),
    ...pendingSeals.map(s => s.rawHash),
  ]

  const merkleRoot = buildMerkleRoot(hashes)
  const batchId    = merkleRoot
  const tenantId   = logs[0]?.tenantId || pendingOcrJobs[0]?.tenantId || pendingBundleJobs[0]?.tenantId || pendingSeals[0]?.tenantId

  // ── 4. Submit transaction ───────────────────────────────────
  const provider   = getProvider()
  const wallet     = new ethers.Wallet(process.env.ANCHOR_WALLET_KEY || process.env.BLOCKCHAIN_PRIVATE_KEY, provider)
  const anchorData = ethers.hexlify(ethers.toUtf8Bytes(`tulip:${batchId}:${merkleRoot}`))

  let gasLimit
  try {
    const est = await provider.estimateGas({ to: wallet.address, data: anchorData })
    gasLimit = (est * 120n) / 100n
  } catch { gasLimit = 100000n }

  const feeData = await provider.getFeeData()

  const tx = await wallet.sendTransaction({
    to: wallet.address, value: 0, data: anchorData,
    gasLimit, gasPrice: feeData.gasPrice,
  })

  logger.info('TX submitted', { txHash: tx.hash, batchId })

  // ── 5. Mark all items as pending ────────────────────────────
  const txOps = []

  // Audit logs
  if (allChainUpdates.length > 0) {
    txOps.push(...allChainUpdates.map(u => prisma.auditLog.update({
      where: { id: u.id },
      data:  { dataHash: u.dataHash, prevHash: u.prevHash, batchId, blockchainTx: tx.hash, anchorStatus: 'pending' },
    })))
  }

  // OCR jobs
  if (pendingOcrJobs.length > 0) {
    txOps.push(prisma.ocrJob.updateMany({
      where: { id: { in: pendingOcrJobs.map(j => j.id) } },
      data: { anchorTxHash: tx.hash },
    }))
  }

  // Bundle jobs
  if (pendingBundleJobs.length > 0) {
    txOps.push(prisma.bundleJob.updateMany({
      where: { id: { in: pendingBundleJobs.map(b => b.id) } },
      data: { anchorTxHash: tx.hash },
    }))
  }

  // Trust seals
  if (pendingSeals.length > 0) {
    txOps.push(prisma.trustSeal.updateMany({
      where: { id: { in: pendingSeals.map(s => s.id) } },
      data: { anchorTxHash: tx.hash, status: 'anchoring' },
    }))
  }

  if (txOps.length > 0) await prisma.$transaction(txOps)

  // ── 6. Wait for confirmation ────────────────────────────────
  logger.info('Waiting for confirmation...')
  let receipt
  try {
    receipt = await tx.wait(2)
  } catch (waitErr) {
    // TRANSACTION_REPLACED: ethers throws when a tx is replaced (speed-up, same nonce).
    // If the replacement tx succeeded (status=1), treat as success.
    if (waitErr.code === 'TRANSACTION_REPLACED' && waitErr.receipt && waitErr.receipt.status === 1) {
      logger.info('TX replaced but replacement succeeded', {
        originalHash: tx.hash,
        replacementHash: waitErr.receipt.hash,
      })
      receipt = waitErr.receipt
    } else {
      // Re-throw any other wait error (genuinely failed tx, network error, etc.)
      throw waitErr
    }
  }

  if (!receipt || receipt.status === 0) {
    const failOps = []
    if (allChainUpdates.length > 0) {
      failOps.push(prisma.auditLog.updateMany({ where: { batchId }, data: { anchorStatus: 'failed' } }))
    }
    if (pendingOcrJobs.length > 0) {
      failOps.push(prisma.ocrJob.updateMany({ where: { id: { in: pendingOcrJobs.map(j => j.id) } }, data: { anchorTxHash: null } }))
    }
    if (pendingBundleJobs.length > 0) {
      failOps.push(prisma.bundleJob.updateMany({ where: { id: { in: pendingBundleJobs.map(b => b.id) } }, data: { anchorTxHash: null } }))
    }
    if (pendingSeals.length > 0) {
      failOps.push(prisma.trustSeal.updateMany({ where: { id: { in: pendingSeals.map(s => s.id) } }, data: { anchorTxHash: null, status: 'issued' } }))
    }
    if (failOps.length > 0) await prisma.$transaction(failOps)

    logger.error('TX failed on chain', { txHash: tx.hash })
    dispatch(tenantId, 'anchor.failed', { batchId, txHash: tx.hash, reason: 'TX reverted' }).catch(() => {})
    siemEmit('anchor.failed', { tenantId, batchId, txHash: tx.hash }).catch(() => {})
    return
  }

  // Use receipt.hash — may differ from tx.hash if transaction was replaced
  const confirmedTxHash = receipt.hash || tx.hash
  const block      = await provider.getBlock(receipt.blockNumber)
  const ancheredAt = new Date(block.timestamp * 1000)

  // ── 7. Mark all items as confirmed ──────────────────────────
  const confirmOps = []

  if (allChainUpdates.length > 0) {
    confirmOps.push(prisma.auditLog.updateMany({
      where: { batchId },
      data: { blockchainTx: confirmedTxHash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, anchorStatus: 'confirmed', ancheredAt },
    }))
  }

  if (pendingOcrJobs.length > 0) {
    confirmOps.push(prisma.ocrJob.updateMany({
      where: { id: { in: pendingOcrJobs.map(j => j.id) } },
      data: { anchorTxHash: confirmedTxHash, anchoredAt: ancheredAt },
    }))
    logger.info(`[anchor] ${pendingOcrJobs.length} OCR job(s) anchored`)
  }

  if (pendingBundleJobs.length > 0) {
    confirmOps.push(prisma.bundleJob.updateMany({
      where: { id: { in: pendingBundleJobs.map(b => b.id) } },
      data: { anchorTxHash: confirmedTxHash, anchoredAt: ancheredAt },
    }))
    logger.info(`[anchor] ${pendingBundleJobs.length} bundle(s) anchored`)
  }

  if (pendingSeals.length > 0) {
    confirmOps.push(prisma.trustSeal.updateMany({
      where: { id: { in: pendingSeals.map(s => s.id) } },
      data: { anchorTxHash: confirmedTxHash, anchoredAt: ancheredAt, blockNumber: receipt.blockNumber, status: 'anchored' },
    }))
    logger.info(`[anchor] ${pendingSeals.length} trust seal(s) anchored`)

    // Webhook: seal.anchored — dispatch per-tenant for each seal batch
    const sealsByTenant = pendingSeals.reduce((acc, s) => {
      if (!acc[s.tenantId]) acc[s.tenantId] = []
      acc[s.tenantId].push(s)
      return acc
    }, {})
    for (const [tid, seals] of Object.entries(sealsByTenant)) {
      for (const s of seals) {
        dispatch(tid, 'seal.anchored', {
          id: s.id, rawHash: s.rawHash, txHash: confirmedTxHash,
          blockNumber: receipt.blockNumber, anchoredAt: ancheredAt.toISOString(),
        }).catch(() => {})
      }
    }
  }

  if (confirmOps.length > 0) await prisma.$transaction(confirmOps)

  logger.info(`Batch confirmed`, {
    blockNumber: receipt.blockNumber,
    auditLogs: logs.length,
    ocrJobs: pendingOcrJobs.length,
    bundles: pendingBundleJobs.length,
    seals: pendingSeals.length,
    batchId,
  })

  // ── Notify uploaders of anchored documents ────────────────
  try {
    const anchoredLogs = await prisma.auditLog.findMany({
      where: { batchId, action: 'DOCUMENT_UPLOADED' },
      select: { entityId: true, tenantId: true },
    })
    for (const log of anchoredLogs) {
      const doc = await prisma.document.findUnique({
        where: { id: log.entityId },
        select: { name: true, uploadedById: true, tenantId: true },
      })
      if (doc?.uploadedById) {
        const uploader = await prisma.user.findUnique({
          where: { id: doc.uploadedById },
          select: { email: true, name: true },
        })
        if (uploader) {
          notifyDocumentAnchored({
            tenantId: doc.tenantId,
            documentName: doc.name,
            uploaderEmail: uploader.email,
            uploaderName: uploader.name,
            txHash: confirmedTxHash,
          }).catch(() => {})
        }
      }
      // Webhook: document.verified
      dispatch(doc.tenantId, 'document.verified', {
        id: log.entityId, name: doc.name, blockchainTx: confirmedTxHash,
      }).catch(() => {})
    }
  } catch (err) {
    logger.error('[anchor] Document notification failed', { error: err.message })
  }

  // ── Archive to S3 ─────────────────────────────────────────
  try {
    const archiveResult = await archiveBatch(batchId)
    logger.info('[archive] Batch archived', {
      s3Key:      archiveResult.s3Key,
      recordCount: archiveResult.recordCount,
    })

    // Emit SIEM archive event
    siemEmit('anchor.archived', {
      tenantId,
      batchId,
      s3Key:         archiveResult.s3Key,
      integrityHash: archiveResult.integrityHash,
      recordCount:   archiveResult.recordCount,
    }).catch(() => {})

  } catch (err) {
    // Archive failure must NOT fail the anchor — log and alert
    logger.error('[archive] S3 archive failed — batch confirmed but not archived', {
      batchId,
      error: err.message,
    })
    siemEmit('anchor.archive_failed', {
      tenantId, batchId, error: err.message
    }).catch(() => {})
  }

  // Dispatch webhook + SIEM
  dispatch(tenantId, 'anchor.confirmed', {
    batchId,
    txHash:      confirmedTxHash,
    blockNumber: receipt.blockNumber,
    blockHash:   receipt.blockHash,
    ancheredAt:  ancheredAt.toISOString(),
    recordCount: totalPending,
  }).catch(() => {})

  siemEmit('anchor.confirmed', {
    tenantId,
    batchId,
    txHash:      confirmedTxHash,
    blockNumber: receipt.blockNumber,
    recordCount: totalPending,
  }).catch(() => {})
}

module.exports = { anchorBatch }
