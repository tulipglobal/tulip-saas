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
  const logs = await prisma.auditLog.findMany({
    where:   { blockchainTx: null },
    take:    20,
    orderBy: { createdAt: 'asc' },
  })

  if (logs.length === 0) { logger.info('No logs to anchor'); return }
  logger.info(`Anchoring ${logs.length} log(s)...`)

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

  const hashes     = allChainUpdates.map(u => u.dataHash)
  const merkleRoot = buildMerkleRoot(hashes)
  const batchId    = merkleRoot
  const tenantId   = logs[0].tenantId

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

  await prisma.$transaction(
    allChainUpdates.map(u => prisma.auditLog.update({
      where: { id: u.id },
      data:  { dataHash: u.dataHash, prevHash: u.prevHash, batchId, blockchainTx: tx.hash, anchorStatus: 'pending' },
    }))
  )

  logger.info('Waiting for confirmation...')
  const receipt = await tx.wait(2)

  if (!receipt || receipt.status === 0) {
    await prisma.auditLog.updateMany({
      where: { batchId },
      data:  { anchorStatus: 'failed' },
    })
    logger.error('TX failed on chain', { txHash: tx.hash })

    dispatch(tenantId, 'anchor.failed', { batchId, txHash: tx.hash, reason: 'TX reverted' }).catch(() => {})
    siemEmit('anchor.failed', { tenantId, batchId, txHash: tx.hash }).catch(() => {})
    return
  }

  const block      = await provider.getBlock(receipt.blockNumber)
  const ancheredAt = new Date(block.timestamp * 1000)

  await prisma.auditLog.updateMany({
    where: { batchId },
    data: {
      blockNumber:  receipt.blockNumber,
      blockHash:    receipt.blockHash,
      anchorStatus: 'confirmed',
      ancheredAt,
    },
  })

  logger.info(`Batch confirmed`, {
    blockNumber: receipt.blockNumber,
    recordCount: logs.length,
    batchId,
  })

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
    txHash:      tx.hash,
    blockNumber: receipt.blockNumber,
    blockHash:   receipt.blockHash,
    ancheredAt:  ancheredAt.toISOString(),
    recordCount: logs.length,
  }).catch(() => {})

  siemEmit('anchor.confirmed', {
    tenantId,
    batchId,
    txHash:      tx.hash,
    blockNumber: receipt.blockNumber,
    recordCount: logs.length,
  }).catch(() => {})
}

module.exports = { anchorBatch }
