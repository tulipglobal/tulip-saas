// ─────────────────────────────────────────────────────────────
//  routes/verifyPublicRoutes.js — Public document preview by hash (no auth)
//  Used by verify.sealayer.io to fetch document URL + metadata after hash verification
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const prisma = require('../lib/client')
const { getPresignedUrl, getPresignedUrlFromKey } = require('../lib/s3Upload')

// GET /api/public/verify/:hash — document preview for verified hash
router.get('/:hash', async (req, res) => {
  const { hash } = req.params

  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return res.status(400).json({ error: 'Invalid hash format' })
  }

  try {
    // 1. Check TrustSeal by rawHash
    const seal = await prisma.trustSeal.findFirst({
      where: { rawHash: hash },
      include: {
        Tenant: { select: { name: true, tenantType: true, logoUrl: true, country: true } },
      },
    })

    if (seal) {
      let docUrl = null
      if (seal.s3Key) {
        const mime = toMimeType(seal.fileType)
        docUrl = await getPresignedUrlFromKey(seal.s3Key, 3600, mime ? { contentType: mime } : {}).catch(() => null)
      }

      return res.json({
        verified: true,
        documentTitle: seal.documentTitle,
        documentType: seal.documentType,
        issuedTo: seal.issuedTo,
        issuedBy: seal.issuedBy,
        issuedAt: seal.createdAt,
        hasDocument: !!seal.s3Key,
        fileType: seal.fileType || null,
        docUrl,
        fileUrl: docUrl,
        qrCodeUrl: seal.qrCodeUrl,
        metadata: seal.metadata,
        issuer: seal.Tenant ? {
          name: seal.Tenant.name,
          type: seal.Tenant.tenantType,
          logoUrl: seal.Tenant.logoUrl,
          country: seal.Tenant.country,
        } : null,
        blockchain: {
          network: 'Polygon',
          txHash: seal.anchorTxHash || null,
          blockNumber: seal.blockNumber || null,
          anchorStatus: seal.anchorTxHash ? 'confirmed' : 'pending',
          anchoredAt: seal.anchoredAt || null,
        },
      })
    }

    // 2. Check Document by sha256Hash
    const doc = await prisma.document.findFirst({
      where: { sha256Hash: hash },
      include: {
        project: { select: { name: true } },
        expense: { select: { description: true, amount: true, currency: true } },
      },
    })

    if (doc) {
      let docUrl = null
      if (doc.fileUrl) {
        docUrl = await getPresignedUrl(doc.fileUrl).catch(() => null)
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: doc.tenantId },
        select: { name: true, tenantType: true, logoUrl: true, country: true },
      })

      return res.json({
        verified: true,
        documentTitle: doc.name,
        documentType: doc.documentType || 'document',
        fileType: doc.fileType || null,
        hasDocument: !!doc.fileUrl,
        docUrl,
        fileUrl: docUrl,
        issuedAt: doc.uploadedAt,
        issuer: tenant ? {
          name: tenant.name,
          type: tenant.tenantType,
          logoUrl: tenant.logoUrl,
          country: tenant.country,
        } : null,
      })
    }

    // 3. Check OcrJob by hashValue
    const ocrJob = await prisma.ocrJob.findFirst({
      where: { hashValue: hash },
      include: { Tenant: { select: { name: true, tenantType: true, logoUrl: true, country: true } } },
    })

    if (ocrJob) {
      let docUrl = null
      if (ocrJob.sealedPdfKey) {
        docUrl = await getPresignedUrlFromKey(ocrJob.sealedPdfKey, 3600, { contentType: 'application/pdf' }).catch(() => null)
      } else if (ocrJob.s3Key) {
        const mime = toMimeType(ocrJob.fileType)
        docUrl = await getPresignedUrlFromKey(ocrJob.s3Key, 3600, mime ? { contentType: mime } : {}).catch(() => null)
      }

      return res.json({
        verified: true,
        documentTitle: ocrJob.originalFilename,
        documentType: ocrJob.documentType || 'document',
        fileType: ocrJob.fileType || null,
        hasDocument: !!docUrl,
        docUrl,
        fileUrl: docUrl,
        issuedAt: ocrJob.createdAt,
        issuer: ocrJob.Tenant ? {
          name: ocrJob.Tenant.name,
          type: ocrJob.Tenant.tenantType,
          logoUrl: ocrJob.Tenant.logoUrl,
          country: ocrJob.Tenant.country,
        } : null,
      })
    }

    return res.status(404).json({ verified: false, error: 'Hash not found' })
  } catch (err) {
    console.error('[public/verify] error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

function toMimeType(ft) {
  if (!ft) return undefined
  const l = ft.toLowerCase().replace(/^\./, '')
  const map = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', tiff: 'image/tiff', tif: 'image/tiff', svg: 'image/svg+xml', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  if (l.includes('/')) return l
  return map[l] || undefined
}

module.exports = router
