// ─────────────────────────────────────────────────────────────
//  services/universalSealService.js
//
//  Auto-issues a TrustSeal for any hashed document in the system.
//  Deduplicates by rawHash — if a seal for the same hash already
//  exists in the tenant, returns the existing one.
// ─────────────────────────────────────────────────────────────

const prisma = require('../lib/client')

/**
 * @param {Object} opts
 * @param {string} opts.documentTitle
 * @param {string} opts.documentType   e.g. 'ngo-document', 'funding-agreement', 'api-document', 'bundle', 'budget-agreement'
 * @param {string} opts.rawHash        SHA-256 hex string
 * @param {string} opts.issuedBy       org / entity name
 * @param {string} opts.issuedTo       org / entity name
 * @param {string} opts.tenantId
 * @param {string} [opts.fileKey]      S3 key
 * @param {string} [opts.fileType]     e.g. 'pdf', 'png'
 * @param {Object} [opts.metadata]     arbitrary JSON metadata
 * @returns {Promise<Object>}          the TrustSeal record
 */
async function autoIssueSeal({
  documentTitle, documentType, rawHash,
  issuedBy, issuedTo, tenantId,
  fileKey, fileType, metadata,
}) {
  if (!rawHash || !tenantId) throw new Error('rawHash and tenantId are required')

  // Validate tenant exists (prevents FK constraint violation)
  const tenantExists = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })
  if (!tenantExists) {
    console.error('[autoIssueSeal] Tenant not found:', tenantId)
    throw new Error(`Tenant not found: ${tenantId}`)
  }

  // Deduplicate: check if a seal for this hash already exists in this tenant
  const existing = await prisma.trustSeal.findFirst({
    where: { rawHash, tenantId },
  })
  if (existing) return existing

  const seal = await prisma.trustSeal.create({
    data: {
      tenantId,
      documentTitle: documentTitle || 'Untitled Document',
      documentType:  documentType || 'document',
      issuedBy:      issuedBy || 'Organization',
      issuedTo:      issuedTo || issuedBy || 'Organization',
      rawHash,
      s3Key:         fileKey || null,
      fileType:      fileType || null,
      metadata:      metadata || null,
      anchorTxHash:  null,
      status:        'pending',
    },
  })

  return seal
}

module.exports = { autoIssueSeal }
