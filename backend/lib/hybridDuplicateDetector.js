const prisma = require('./client')
const { generateOcrFingerprint } = require('./ocrFingerprint')
const { computePHashFromFile, hammingDistance } = require('./pHashService')
const { createAuditLog } = require('../services/auditService')

const PHASH_THRESHOLD = 10

/**
 * Run hybrid duplicate detection combining OCR fingerprint + pHash.
 *
 * @param {Object} opts
 * @param {Buffer} opts.fileBuffer - raw file buffer
 * @param {string} opts.fileType - file extension (e.g. 'pdf', 'jpg')
 * @param {string|null} opts.ocrRawText - raw OCR text (null if OCR not run)
 * @param {string} opts.documentId - the new document's ID
 * @param {string} opts.tenantId - current tenant
 * @param {string} opts.userId - uploading user
 * @param {'document'|'trustseal'} opts.entityTable - which table to check against
 * @returns {Promise<Object>} detection result + fields to store
 */
async function detectDuplicates(opts) {
  const { fileBuffer, fileType, ocrRawText, documentId, tenantId, userId, entityTable = 'document' } = opts

  const result = {
    isDuplicate: false,
    confidence: 'NONE',
    method: null,
    matchedDocumentId: null,
    matchedDocumentName: null,
    crossTenant: false,
    ocrMatch: false,
    visualMatch: false,
    hammingDistance: null,
    ocrFingerprint: null,
    pHash: null,
    // Fields to write on the document record
    updateData: {},
  }

  // ── OCR fingerprint ──
  let ocrFingerprint = null
  if (ocrRawText) {
    ocrFingerprint = generateOcrFingerprint(ocrRawText)
    result.ocrFingerprint = ocrFingerprint
    if (ocrFingerprint) {
      result.updateData.ocrFingerprint = ocrFingerprint
    }
  }

  // ── pHash ──
  let pHash = null
  const pHashTypes = ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp', 'gif']
  if (pHashTypes.includes((fileType || '').toLowerCase())) {
    pHash = await computePHashFromFile(fileBuffer, fileType)
    result.pHash = pHash
    if (pHash) {
      result.updateData.pHash = pHash
    }
  }

  // ── Same-tenant OCR match ──
  let ocrSameTenant = null
  if (ocrFingerprint) {
    if (entityTable === 'document') {
      ocrSameTenant = await prisma.document.findFirst({
        where: { ocrFingerprint, tenantId, id: { not: documentId } },
        select: { id: true, name: true, uploadedAt: true },
      })
    } else {
      ocrSameTenant = await prisma.trustSeal.findFirst({
        where: { ocrFingerprint, tenantId, id: { not: documentId } },
        select: { id: true, documentTitle: true, createdAt: true },
      })
      if (ocrSameTenant) {
        ocrSameTenant = { id: ocrSameTenant.id, name: ocrSameTenant.documentTitle, uploadedAt: ocrSameTenant.createdAt }
      }
    }
  }

  // ── Same-tenant pHash match ──
  let pHashSameTenant = null
  let bestHamming = 64
  if (pHash && entityTable === 'document') {
    const candidates = await prisma.document.findMany({
      where: { pHash: { not: null }, tenantId, id: { not: documentId } },
      select: { id: true, name: true, pHash: true, uploadedAt: true },
    })
    for (const c of candidates) {
      const dist = hammingDistance(pHash, c.pHash)
      if (dist <= PHASH_THRESHOLD && dist < bestHamming) {
        bestHamming = dist
        pHashSameTenant = c
      }
    }
  }

  // ── Cross-tenant OCR match ──
  let ocrCrossTenant = false
  if (ocrFingerprint) {
    const cross = entityTable === 'document'
      ? await prisma.document.findFirst({
          where: { ocrFingerprint, tenantId: { not: tenantId } },
          select: { id: true },
        })
      : await prisma.trustSeal.findFirst({
          where: { ocrFingerprint, tenantId: { not: tenantId } },
          select: { id: true },
        })
    if (cross) ocrCrossTenant = true
  }

  // ── Cross-tenant pHash match ──
  let pHashCrossTenant = false
  if (pHash && entityTable === 'document') {
    const crossDocs = await prisma.document.findMany({
      where: { pHash: { not: null }, tenantId: { not: tenantId } },
      select: { id: true, pHash: true },
    })
    for (const c of crossDocs) {
      if (hammingDistance(pHash, c.pHash) <= PHASH_THRESHOLD) {
        pHashCrossTenant = true
        break
      }
    }
  }

  // ── Determine confidence ──
  const hasOcrMatch = !!ocrSameTenant || ocrCrossTenant
  const hasVisualMatch = !!pHashSameTenant || pHashCrossTenant
  const hasCrossTenant = ocrCrossTenant || pHashCrossTenant

  result.ocrMatch = hasOcrMatch
  result.visualMatch = hasVisualMatch
  result.crossTenant = hasCrossTenant
  if (pHashSameTenant) result.hammingDistance = bestHamming

  if (hasCrossTenant) {
    result.isDuplicate = true
    result.confidence = 'HIGH'
    result.method = hasOcrMatch && hasVisualMatch ? 'HYBRID' : hasOcrMatch ? 'OCR_FINGERPRINT' : 'PHASH'
  } else if (hasOcrMatch && hasVisualMatch) {
    result.isDuplicate = true
    result.confidence = 'HIGH'
    result.method = 'HYBRID'
  } else if (hasOcrMatch) {
    result.isDuplicate = true
    result.confidence = 'MEDIUM'
    result.method = 'OCR_FINGERPRINT'
  } else if (hasVisualMatch) {
    result.isDuplicate = true
    result.confidence = 'LOW'
    result.method = 'PHASH'
  }

  // Pick best match for display
  const bestMatch = ocrSameTenant || pHashSameTenant
  if (bestMatch) {
    result.matchedDocumentId = bestMatch.id
    result.matchedDocumentName = bestMatch.name
  }

  // ── Build update data for document record ──
  if (entityTable === 'document') {
    if (ocrSameTenant) {
      result.updateData.isDuplicate = true
      result.updateData.duplicateOfId = ocrSameTenant.id
      result.updateData.duplicateOfName = ocrSameTenant.name
    }
    if (ocrCrossTenant) {
      result.updateData.crossTenantDuplicate = true
    }
    if (pHashSameTenant) {
      result.updateData.isVisualDuplicate = true
      result.updateData.visualDuplicateOfId = pHashSameTenant.id
      result.updateData.visualDuplicateOfName = pHashSameTenant.name
    }
    if (pHashCrossTenant) {
      result.updateData.crossTenantVisualDuplicate = true
    }
    if (result.isDuplicate) {
      result.updateData.duplicateConfidence = result.confidence
      result.updateData.duplicateMethod = result.method
    }
  }

  // ── Audit logging ──
  // Individual logs (preserved from #5/#6)
  if (ocrSameTenant) {
    createAuditLog({
      action: 'DUPLICATE_DOCUMENT_DETECTED',
      entityType: entityTable === 'document' ? 'Document' : 'Expense',
      entityId: documentId,
      userId,
      tenantId,
    }).catch(() => {})
  }
  if (ocrCrossTenant) {
    createAuditLog({
      action: 'CROSS_ORG_DUPLICATE_DETECTED',
      entityType: entityTable === 'document' ? 'Document' : 'Expense',
      entityId: documentId,
      userId,
      tenantId,
    }).catch(() => {})
  }
  if (pHashSameTenant) {
    createAuditLog({
      action: 'VISUAL_DUPLICATE_DETECTED',
      entityType: 'Document',
      entityId: documentId,
      userId,
      tenantId,
    }).catch(() => {})
  }
  if (pHashCrossTenant) {
    createAuditLog({
      action: 'CROSS_ORG_VISUAL_DUPLICATE_DETECTED',
      entityType: 'Document',
      entityId: documentId,
      userId,
      tenantId,
    }).catch(() => {})
  }

  // Unified hybrid log
  if (result.isDuplicate) {
    createAuditLog({
      action: 'HYBRID_DUPLICATE_DETECTED',
      entityType: entityTable === 'document' ? 'Document' : 'Expense',
      entityId: documentId,
      userId,
      tenantId,
    }).catch(() => {})
    console.log(`[hybrid-dup] ${result.confidence} duplicate: doc=${documentId} method=${result.method} ocrMatch=${result.ocrMatch} visualMatch=${result.visualMatch} crossTenant=${result.crossTenant}`)
  }

  return result
}

module.exports = { detectDuplicates }
