// backend/routes/ocrRoutes.js
const express = require('express')
const multer  = require('multer')
const crypto  = require('crypto')
const path    = require('path')
const router  = express.Router()
const prisma  = require('../lib/client')
const { can } = require('../middleware/permission')
const { extractText, uploadToS3 } = require('../services/ocrService')
const { normaliseDocument, assessDocument } = require('../services/documentNormaliser')
const { generateOcrPdf } = require('../services/ocrPdfService')
const { createAuditLog } = require('../services/auditService')
const logger  = require('../lib/logger')

// Multer — memory storage, max 20MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'application/pdf']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Unsupported file type. Use JPG, PNG, TIFF, WEBP, or PDF.'))
  }
})

// ── POST /api/ocr/process ─────────────────────────────────────────────────────
// Full OCR pipeline: extract → normalise → assess → hash → (queue anchor)
router.post('/process', can('documents:write'), upload.single('file'), async (req, res) => {
  const tenantId = req.user.tenantId
  const userId   = req.user.userId

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  let job
  try {
    // 1. Create job record
    job = await prisma.ocrJob.create({
      data: {
        tenantId,
        originalFilename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        s3Key: '',
        status: 'processing'
      }
    })

    // Return immediately so the UI shows the job
    res.status(201).json({ data: job })

    // 2. Process in background (don't block response)
    processOcrJob(job.id, tenantId, userId, req.file).catch(err => {
      logger.error({ err, jobId: job.id }, 'OCR background processing failed')
    })

  } catch (err) {
    logger.error({ err, jobId: job?.id }, 'OCR upload failed')

    if (job?.id) {
      await prisma.ocrJob.update({
        where: { id: job.id },
        data: { status: 'failed' }
      }).catch(() => {})
    }

    res.status(500).json({ error: 'OCR processing failed', details: err.message })
  }
})

// Background pipeline
async function processOcrJob(jobId, tenantId, userId, file) {
  try {
    // 1. Upload original to S3
    const s3Key = `ocr/${tenantId}/${jobId}/original${path.extname(file.originalname)}`
    await uploadToS3(file.buffer, s3Key, file.mimetype)

    await prisma.ocrJob.update({
      where: { id: jobId },
      data: { s3Key, status: 'extracting' }
    })

    // 2. Extract text via Textract
    logger.info({ jobId }, 'Starting OCR extraction')
    const ocrResult = await extractText(s3Key)

    await prisma.ocrJob.update({
      where: { id: jobId },
      data: { rawText: ocrResult.rawText, confidence: ocrResult.confidence, status: 'normalising' }
    })

    // 3. Normalise via Claude AI
    logger.info({ jobId }, 'Normalising document')
    const normalisedDoc = await normaliseDocument(
      ocrResult.rawText,
      ocrResult.keyValuePairs,
      ocrResult.tables,
      file.originalname
    )

    await prisma.ocrJob.update({
      where: { id: jobId },
      data: { documentType: normalisedDoc.documentType, detectedLanguage: normalisedDoc.detectedLanguage, normalisedJson: normalisedDoc, status: 'assessing' }
    })

    // 4. Assess via Claude AI
    logger.info({ jobId }, 'Assessing document')
    const assessment = await assessDocument(normalisedDoc, ocrResult.rawText)

    await prisma.ocrJob.update({
      where: { id: jobId },
      data: {
        assessmentScore: assessment.riskScore,
        assessmentResult: assessment.riskLevel,
        assessmentNotes: assessment.summary,
        flags: assessment.flags || [],
        status: 'generating_pdf'
      }
    })

    // 5. Generate clean normalised PDF
    logger.info({ jobId }, 'Generating normalised PDF')
    const pdfBuffer = await generateOcrPdf(normalisedDoc, assessment, jobId)
    const pdfS3Key = `ocr/${tenantId}/${jobId}/normalised.pdf`
    await uploadToS3(pdfBuffer, pdfS3Key, 'application/pdf')

    // 6. Hash the normalised PDF
    const hashValue = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

    // 7. Mark complete
    await prisma.ocrJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        normalisedPdfS3: pdfS3Key,
        hashValue,
      }
    })

    logger.info({ jobId, hashValue }, 'OCR job completed')

    // 8. Audit log
    createAuditLog({
      action: 'ocr.processed',
      entityType: 'OcrJob',
      entityId: jobId,
      userId,
      tenantId,
    }).catch(() => {})

  } catch (err) {
    logger.error({ err, jobId }, 'OCR pipeline error')
    await prisma.ocrJob.update({
      where: { id: jobId },
      data: { status: 'failed' }
    }).catch(() => {})
  }
}

// ── GET /api/ocr/jobs ─────────────────────────────────────────────────────────
router.get('/jobs', can('documents:read'), async (req, res) => {
  try {
    const jobs = await prisma.ocrJob.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json({ data: jobs, total: jobs.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/ocr/jobs/:id ─────────────────────────────────────────────────────
router.get('/jobs/:id', can('documents:read'), async (req, res) => {
  try {
    const job = await prisma.ocrJob.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId }
    })
    if (!job) return res.status(404).json({ error: 'Job not found' })
    res.json({ data: job })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/ocr/jobs/:id/pdf ─────────────────────────────────────────────────
router.get('/jobs/:id/pdf', can('documents:read'), async (req, res) => {
  try {
    const job = await prisma.ocrJob.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId }
    })
    if (!job || !job.normalisedPdfS3) return res.status(404).json({ error: 'PDF not found' })

    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
    const s3 = new S3Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    })
    const url = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: job.normalisedPdfS3
    }), { expiresIn: 300 })

    res.json({ url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
