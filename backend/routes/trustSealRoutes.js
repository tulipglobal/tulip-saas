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

    // Get org name for issuedBy fallback
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { name: true }
    })

    // Hash the file content and upload to S3
    let rawHash, s3Key = null, fileType = null
    if (req.file) {
      rawHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex')
      const upload = await uploadToS3(req.file.buffer, req.file.originalname, req.user.tenantId, 'seals')
      s3Key = upload.key
      fileType = req.file.mimetype || req.file.originalname.split('.').pop()
    } else if (fileBase64) {
      const buf = Buffer.from(fileBase64, 'base64')
      rawHash = crypto.createHash('sha256').update(buf).digest('hex')
      const upload = await uploadToS3(buf, `seal-${Date.now()}.bin`, req.user.tenantId, 'seals')
      s3Key = upload.key
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
    const seal = await db.trustSeal.create({
      data: {
        documentTitle,
        documentType: documentType || 'CERTIFICATE',
        issuedTo,
        issuedToEmail: issuedToEmail || null,
        issuedBy: issuedBy || tenant?.name || 'Unknown',
        metadata: parsedMetadata,
        rawHash,
        s3Key,
        fileType,
        status: 'issued',
      },
    })

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
