// ─────────────────────────────────────────────────────────────
//  routes/sealIssuanceRoutes.js — POST /api/seal/issue
//
//  External issuance API. Authenticated via x-api-key header.
//  Accepts base64-encoded PDF, hashes every page, stores seal,
//  queues Polygon anchor, returns seal + QR + page hashes.
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const QRCode = require('qrcode')
const prisma = require('../lib/client')
const { validateApiKey } = require('../services/apiKeyService')
const { hashPdfPages } = require('../lib/pdfPageHasher')
const { uploadToS3 } = require('../lib/s3Upload')
const { createAuditLog } = require('../services/auditService')
const logger = require('../lib/logger')

// Middleware: authenticate via x-api-key header
async function apiKeyAuth(req, res, next) {
  const rawKey = req.headers['x-api-key']
  if (!rawKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' })
  }

  try {
    const apiKey = await validateApiKey(rawKey)
    if (!apiKey) {
      return res.status(401).json({ error: 'Invalid or revoked API key' })
    }

    req.user = {
      userId: apiKey.createdBy,
      tenantId: apiKey.tenantId,
      authMethod: 'apikey',
      keyId: apiKey.id,
      permissions: apiKey.permissions,
    }
    req.apiKey = apiKey
    next()
  } catch (err) {
    logger.error('API key validation failed', { error: err.message })
    return res.status(500).json({ error: 'API key validation failed' })
  }
}

// POST /api/seal/issue
router.post('/issue', apiKeyAuth, express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { pdf, document_type, issuer_reference, metadata } = req.body

    if (!pdf) {
      return res.status(400).json({ error: 'pdf field is required (base64-encoded PDF)' })
    }

    const validTypes = ['invoice', 'bank_statement', 'contract', 'other']
    const docType = validTypes.includes(document_type) ? document_type : 'other'

    // Decode base64 PDF
    let pdfBuffer
    try {
      pdfBuffer = Buffer.from(pdf, 'base64')
      if (pdfBuffer.length === 0) throw new Error('Empty buffer')
    } catch {
      return res.status(400).json({ error: 'Invalid base64-encoded PDF' })
    }

    // Get tenant info
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { name: true, plan: true },
    })

    // Enforce seal limits
    const plan = tenant?.plan || 'FREE'
    const SEAL_LIMITS = { FREE: 5, STARTER: 50, PRO: -1, ENTERPRISE: -1 }
    const limit = SEAL_LIMITS[plan] ?? 5
    if (limit !== -1) {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const sealsThisMonth = await prisma.trustSeal.count({
        where: { tenantId: req.user.tenantId, createdAt: { gte: monthStart } },
      })
      if (sealsThisMonth >= limit) {
        return res.status(403).json({
          error: `Seal limit reached (${limit}/month on ${plan} plan). Upgrade for more.`,
          sealsUsed: sealsThisMonth,
          sealLimit: limit,
          plan,
        })
      }
    }

    // Hash every page + full document
    const { fullHash, pageHashes } = await hashPdfPages(pdfBuffer)

    // Upload PDF to S3
    const fileName = `seal-${Date.now()}.pdf`
    const s3Result = await uploadToS3(pdfBuffer, fileName, req.user.tenantId, 'seals')

    // Capture IP address
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || null

    // Create seal record
    const seal = await prisma.trustSeal.create({
      data: {
        tenantId: req.user.tenantId,
        documentTitle: issuer_reference || `API Seal - ${docType}`,
        documentType: docType,
        issuedBy: tenant?.name || 'Organization',
        issuedTo: tenant?.name || 'Organization',
        rawHash: fullHash,
        pageHashes: pageHashes.length > 0 ? pageHashes : undefined,
        s3Key: s3Result.key,
        fileType: 'application/pdf',
        metadata: metadata || undefined,
        issuerReference: issuer_reference || null,
        apiKeyId: req.user.keyId,
        ipAddress,
        status: 'pending',
      },
    })

    // Generate QR code
    const verifyUrl = `https://verify.tulipds.com/verify?hash=${fullHash}`
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#0c7aed', light: '#ffffff' },
    })

    // Update seal with QR code
    await prisma.trustSeal.update({
      where: { id: seal.id },
      data: { qrCodeUrl: qrCodeDataUrl },
    })

    // Audit log
    createAuditLog({
      action: 'TRUST_SEAL_ISSUED',
      entityType: 'TrustSeal',
      entityId: seal.id,
      userId: req.user.userId,
      tenantId: req.user.tenantId,
    }).catch(() => {})

    logger.info('[seal-issue] Seal created via API', {
      sealId: seal.id,
      tenantId: req.user.tenantId,
      apiKeyId: req.user.keyId,
      docType,
      pageCount: pageHashes.length,
    })

    // Return response
    res.status(201).json({
      seal_id: seal.id,
      full_hash: fullHash,
      page_hashes: pageHashes,
      qr_code: qrCodeDataUrl,
      verify_url: verifyUrl,
      blockchain_status: 'pending',
      issued_at: seal.createdAt.toISOString(),
    })
  } catch (err) {
    logger.error('Failed to issue seal via API', { error: err.message })
    res.status(500).json({ error: 'Failed to issue seal' })
  }
})

module.exports = router
