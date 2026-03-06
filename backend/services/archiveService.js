// ─────────────────────────────────────────────────────────────
//  services/archiveService.js — v1
//
//  Archives Merkle batch JSON to S3 after every anchor.
//  Path schema: {tenantId}/YYYY/MM/DD/merkle_{batchId}.json
//
//  Contents of each archive file:
//  {
//    batchId, merkleRoot, txHash, blockNumber,
//    ancheredAt, recordCount, tenantId,
//    records: [ { id, dataHash, prevHash, action, entityType, ... } ],
//    archivedAt, integrityHash  ← SHA-256 of the entire file
//  }
//
//  Configure via .env:
//    AWS_REGION=ap-south-1
//    AWS_S3_BUCKET=tulipglobal.org
//    AWS_ACCESS_KEY_ID=...       ← from ~/.aws/credentials (auto-loaded)
//    AWS_SECRET_ACCESS_KEY=...   ← from ~/.aws/credentials (auto-loaded)
// ─────────────────────────────────────────────────────────────

const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3')
const crypto  = require('crypto')
const prisma  = require('../lib/client')
const logger  = require('../lib/logger')

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    // Credentials auto-loaded from:
    // 1. env vars AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY
    // 2. ~/.aws/credentials
    // 3. EC2/ECS instance role (production)
  })
}

const BUCKET = process.env.AWS_S3_BUCKET || 'tulipglobal.org'

// ── Build S3 key path ─────────────────────────────────────────
// e.g. 9db996bf.../2026/03/06/merkle_abc123....json
function buildS3Key(tenantId, batchId, ancheredAt) {
  const date = new Date(ancheredAt || Date.now())
  const y    = date.getUTCFullYear()
  const m    = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d    = String(date.getUTCDate()).padStart(2, '0')
  return `${tenantId}/${y}/${m}/${d}/merkle_${batchId}.json`
}

// ── Archive a confirmed batch to S3 ──────────────────────────
async function archiveBatch(batchId) {
  const records = await prisma.auditLog.findMany({
    where:   { batchId },
    orderBy: { createdAt: 'asc' },
    select: {
      id:           true,
      action:       true,
      entityType:   true,
      entityId:     true,
      userId:       true,
      tenantId:     true,
      dataHash:     true,
      prevHash:     true,
      batchId:      true,
      blockchainTx: true,
      blockNumber:  true,
      blockHash:    true,
      anchorStatus: true,
      ancheredAt:   true,
      createdAt:    true,
    }
  })

  if (records.length === 0) {
    logger.warn('[archive] No records found for batch', { batchId })
    return null
  }

  const first     = records[0]
  const tenantId  = first.tenantId
  const ancheredAt = first.ancheredAt || new Date()

  const archivePayload = {
    batchId,
    merkleRoot:   batchId,  // batchId IS the merkle root in our system
    txHash:       first.blockchainTx,
    blockNumber:  first.blockNumber,
    blockHash:    first.blockHash,
    ancheredAt:   ancheredAt,
    recordCount:  records.length,
    tenantId,
    records,
    archivedAt:   new Date().toISOString(),
    integrityHash: null,  // filled below
  }

  // Compute integrity hash of the full archive file
  const payloadStr = JSON.stringify({ ...archivePayload, integrityHash: undefined })
  archivePayload.integrityHash = crypto
    .createHash('sha256')
    .update(payloadStr)
    .digest('hex')

  const s3Key  = buildS3Key(tenantId, batchId, ancheredAt)
  const body   = JSON.stringify(archivePayload, null, 2)

  const s3 = getS3Client()

  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         s3Key,
    Body:        body,
    ContentType: 'application/json',
    Metadata: {
      'batch-id':       batchId,
      'tenant-id':      tenantId,
      'tx-hash':        first.blockchainTx || '',
      'block-number':   String(first.blockNumber || ''),
      'record-count':   String(records.length),
      'integrity-hash': archivePayload.integrityHash,
    },
    // Server-side encryption
    ServerSideEncryption: 'AES256',
  }))

  logger.info('[archive] Batch archived to S3', {
    batchId,
    tenantId,
    s3Key,
    recordCount: records.length,
    integrityHash: archivePayload.integrityHash,
  })

  return {
    s3Key,
    bucket:        BUCKET,
    batchId,
    recordCount:   records.length,
    integrityHash: archivePayload.integrityHash,
    archivedAt:    archivePayload.archivedAt,
  }
}

// ── Retrieve an archived batch from S3 ───────────────────────
async function retrieveArchive(tenantId, batchId, ancheredAt) {
  const s3Key = buildS3Key(tenantId, batchId, ancheredAt)
  const s3    = getS3Client()

  const response = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key:    s3Key,
  }))

  const body    = await response.Body.transformToString()
  const archive = JSON.parse(body)

  // Verify integrity hash on retrieval
  const { integrityHash, ...rest } = archive
  const recomputed = crypto
    .createHash('sha256')
    .update(JSON.stringify({ ...rest, integrityHash: undefined }))
    .digest('hex')

  const intact = recomputed === integrityHash

  return { ...archive, _retrievalIntegrityCheck: { intact, recomputed } }
}

// ── Check if a batch is already archived ─────────────────────
async function isArchived(tenantId, batchId, ancheredAt) {
  try {
    const s3Key = buildS3Key(tenantId, batchId, ancheredAt)
    const s3    = getS3Client()
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: s3Key }))
    return true
  } catch {
    return false
  }
}

module.exports = { archiveBatch, retrieveArchive, isArchived, buildS3Key }
