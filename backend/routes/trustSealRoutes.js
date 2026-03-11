// ─────────────────────────────────────────────────────────────
//  routes/trustSealRoutes.js — Trust Seal issuance & lookup
// ─────────────────────────────────────────────────────────────

const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const multer = require('multer')
const QRCode = require('qrcode')
const tenantClient = require('../lib/tenantClient')
const prisma = require('../lib/client')
const { parsePagination, paginatedResponse } = require('../lib/paginate')
const { createAuditLog } = require('../services/auditService')
const { trackEvent } = require('../services/engagementService')
const { uploadToS3 } = require('../lib/s3Upload')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

// POST /api/trust-seal/issue — issue a new trust seal
router.post('/issue', upload.single('file'), async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { documentTitle, documentType, issuedTo, issuedToEmail, issuedBy, metadata, fileBase64 } = req.body

    if (!documentTitle || !issuedTo) {
      return res.status(400).json({ error: 'documentTitle and issuedTo are required' })
    }

    // Get org name for issuedBy fallback + plan for usage check
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { name: true, plan: true }
    })

    // Enforce seal usage limits per plan
    const plan = tenant?.plan || 'FREE'
    const SEAL_LIMITS = { FREE: 5, STARTER: 50, PRO: -1, ENTERPRISE: -1 }
    const limit = SEAL_LIMITS[plan] ?? 5
    if (limit !== -1) {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const sealsThisMonth = await db.trustSeal.count({ where: { createdAt: { gte: monthStart } } })
      if (sealsThisMonth >= limit) {
        return res.status(403).json({
          error: `Seal limit reached (${limit}/month on ${plan} plan). Upgrade for more.`,
          sealsUsed: sealsThisMonth,
          sealLimit: limit,
          plan,
        })
      }
    }

    // Hash the file content and upload to S3
    const MIME_MAP = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', tiff: 'image/tiff', tif: 'image/tiff', svg: 'image/svg+xml', pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    let rawHash, s3Key = null, fileType = null
    if (req.file) {
      rawHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex')
      const s3Result = await uploadToS3(req.file.buffer, req.file.originalname, req.user.tenantId, 'seals')
      s3Key = s3Result.key
      const ext = (req.file.originalname.split('.').pop() || '').toLowerCase()
      fileType = req.file.mimetype || MIME_MAP[ext] || 'application/octet-stream'
    } else if (fileBase64) {
      const buf = Buffer.from(fileBase64, 'base64')
      rawHash = crypto.createHash('sha256').update(buf).digest('hex')
      const fileName = req.body.fileName || `seal-${Date.now()}.bin`
      const ext = (fileName.split('.').pop() || '').toLowerCase()
      fileType = MIME_MAP[ext] || req.body.fileType || 'application/octet-stream'
      const s3Result = await uploadToS3(buf, fileName, req.user.tenantId, 'seals')
      s3Key = s3Result.key
    } else {
      // Hash the document metadata as fallback
      const canonical = JSON.stringify({
        documentTitle,
        documentType: documentType || 'CERTIFICATE',
        issuedTo,
        issuedBy: issuedBy || tenant?.name,
        timestamp: new Date().toISOString(),
      })
      rawHash = crypto.createHash('sha256').update(canonical).digest('hex')
    }

    // Parse metadata if it's a string
    let parsedMetadata = null
    if (metadata) {
      try {
        parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
      } catch {
        parsedMetadata = { raw: metadata }
      }
    }

    // Create the seal record
    const sealData = {
      documentTitle,
      documentType: documentType || 'CERTIFICATE',
      issuedTo,
      issuedBy: issuedBy || tenant?.name || 'Unknown',
      metadata: parsedMetadata,
      rawHash,
      s3Key,
      fileType,
      status: 'issued',
    }
    if (issuedToEmail) sealData.issuedToEmail = issuedToEmail
    const seal = await db.trustSeal.create({ data: sealData })

    // Generate QR code pointing to verify.tulipds.com/seal/[id]
    const verifyUrl = `https://verify.tulipds.com/seal/${seal.id}`
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#0c7aed', light: '#ffffff' },
    })

    // Update seal with QR code URL
    const updatedSeal = await prisma.trustSeal.update({
      where: { id: seal.id },
      data: { qrCodeUrl: qrCodeDataUrl },
    })

    createAuditLog({
      action: 'TRUST_SEAL_ISSUED',
      entityType: 'TrustSeal',
      entityId: seal.id,
      userId: req.user.userId,
      tenantId: req.user.tenantId,
    }).catch(() => {})

    trackEvent(req.user.tenantId, 'seal_issued', { sealId: seal.id, documentTitle }, req.user.userId).catch(() => {})

    res.status(201).json({
      ...updatedSeal,
      verifyUrl,
      qrCode: qrCodeDataUrl,
    })
  } catch (err) {
    console.error('Failed to issue trust seal:', err)
    res.status(500).json({ error: 'Failed to issue trust seal' })
  }
})

// GET /api/trust-seal — list seals for tenant
router.get('/', async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { skip, take, page, limit } = parsePagination(req)

    const where = {}
    if (req.query.status) where.status = req.query.status
    if (req.query.search) {
      where.OR = [
        { documentTitle: { contains: req.query.search, mode: 'insensitive' } },
        { issuedTo: { contains: req.query.search, mode: 'insensitive' } },
      ]
    }

    const [seals, total] = await Promise.all([
      db.trustSeal.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      db.trustSeal.count({ where }),
    ])

    res.json(paginatedResponse(seals, total, page, limit))
  } catch (err) {
    console.error('Failed to list trust seals:', err)
    res.status(500).json({ error: 'Failed to list trust seals' })
  }
})

// POST /api/trust-seal/resolve — resolve hashes to seal info
router.post('/resolve', async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const { hashes } = req.body
    if (!Array.isArray(hashes) || hashes.length === 0) return res.json({})

    const seals = await db.trustSeal.findMany({
      where: { rawHash: { in: hashes.slice(0, 200) } },
      select: { id: true, rawHash: true, status: true, anchorTxHash: true, anchoredAt: true, documentType: true },
    })

    const map = {}
    for (const s of seals) {
      map[s.rawHash] = { sealId: s.id, anchorStatus: s.anchorTxHash ? 'confirmed' : 'pending', txHash: s.anchorTxHash, documentType: s.documentType }
    }
    res.json(map)
  } catch (err) {
    console.error('Failed to resolve seals:', err)
    res.status(500).json({ error: 'Failed to resolve seals' })
  }
})

// GET /api/trust-seal/:id — get single seal
router.get('/:id', async (req, res) => {
  try {
    const db = tenantClient(req.user.tenantId)
    const seal = await db.trustSeal.findFirst({ where: { id: req.params.id } })
    if (!seal) return res.status(404).json({ error: 'Seal not found' })
    res.json(seal)
  } catch (err) {
    console.error('Failed to get trust seal:', err)
    res.status(500).json({ error: 'Failed to get trust seal' })
  }
})

module.exports = router
