// backend/routes/ocrRoutes.js
const express = require('express')
const multer  = require('multer')
const crypto  = require('crypto')
const path    = require('path')
const router  = express.Router()
const prisma  = require('../lib/client')
const { authenticate } = require('../middleware/auth')
const { extractText, uploadToS3 } = require('../services/ocrService')
const { normaliseDocument, assessDocument } = require('../services/documentNormaliser')
const { generateOcrPdf } = require('../services/ocrPdfService')
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
router.post('/process', authenticate, upload.single('file'), async (req, res) => {
  const tenantId = req.user.tenantId
  const userId   = req.user.id

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

    // 2. Upload original to S3
    const s3Key = `ocr/${tenantId}/${job.id}/original${path.extname(req.file.originalname)}`
    await uploadToS3(req.file.buffer, s3Key, req.file.mimetype)

    await prisma.ocrJob.update({
      where: { id: job.id },
      data: { s3Key }
    })

    // 3. Extract text via Textract
    logger.info({ jobId: job.id }, 'Starting OCR extraction')
    const ocrResult = await extractText(s3Key)

    // 4. Normalise via Claude AI
    logger.info({ jobId: job.id }, 'Normalising document')
    const normalisedDoc = await normaliseDocument(
      ocrResult.rawText,
      ocrResult.keyValuePairs,
      ocrResult.tables,
      req.file.originalname
    )

    // 5. Assess via Claude AI
    logger.info({ jobId: job.id }, 'Assessing document')
    const assessment = await assessDocument(normalisedDoc, ocrResult.rawText, {
      projectName: req.body.projectName,
      projectBudget: req.body.projectBudget
    })

    // 6. Generate clean normalised PDF
    logger.info({ jobId: job.id }, 'Generating normalised PDF')
    const pdfBuffer = await generateOcrPdf(normalisedDoc, assessment, job.id)
    const pdfS3Key = `ocr/${tenantId}/${job.id}/normalised.pdf`
    await uploadToS3(pdfBuffer, pdfS3Key, 'application/pdf')

    // 7. Hash the normalised PDF
    const hashValue = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

    // 8. Update job with all results
    const completed = await prisma.ocrJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        rawText: ocrResult.rawText,
        confidence: ocrResult.confidence,
        documentType: normalisedDoc.documentType,
        detectedLanguage: normalisedDoc.detectedLanguage,
        normalisedJson: normalisedDoc,
        normalisedPdfS3: pdfS3Key,
        assessmentScore: assessment.riskScore,
        assessmentResult: assessment.riskLevel,
        assessmentNotes: assessment.summary,
        flags: assessment.flags || [],
        hashValue,
      }
    })

    // 9. Queue blockchain anchor (will be picked up by scheduler)
    // We store hashValue and it gets anchored in the next batch
    logger.info({ jobId: job.id, hashValue }, 'OCR job completed, queued for anchoring')

    // 10. Log audit
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'ocr.processed',
        entityType: 'OcrJob',
        entityId: job.id,
        metadata: {
          filename: req.file.originalname,
          documentType: normalisedDoc.documentType,
          language: normalisedDoc.detectedLanguage,
          riskLevel: assessment.riskLevel,
          riskScore: assessment.riskScore
        }
      }
    })

    res.json({
      jobId: job.id,
      status: 'completed',
      documentType: normalisedDoc.documentType,
      detectedLanguage: normalisedDoc.detectedLanguage,
      confidence: ocrResult.confidence,
      normalisedDocument: normalisedDoc,
      assessment: {
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        summary: assessment.summary,
        purpose: assessment.purpose,
        positives: assessment.positives,
        flags: assessment.flags,
        mathCheck: assessment.mathCheck,
        completenessScore: assessment.completenessScore,
        recommendation: assessment.recommendation,
        recommendationReason: assessment.recommendationReason
      },
      hash: hashValue,
      anchorStatus: 'queued',
      rawTextPreview: ocrResult.rawText.substring(0, 500)
    })

  } catch (err) {
    logger.error({ err, jobId: job?.id }, 'OCR processing failed')

    if (job?.id) {
      await prisma.ocrJob.update({
        where: { id: job.id },
        data: { status: 'failed' }
      }).catch(() => {})
    }

    res.status(500).json({ error: 'OCR processing failed', details: err.message })
  }
})

// ── GET /api/ocr/jobs ─────────────────────────────────────────────────────────
router.get('/jobs', authenticate, async (req, res) => {
  try {
    const jobs = await prisma.ocrJob.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        originalFilename: true,
        documentType: true,
        detectedLanguage: true,
        status: true,
        confidence: true,
        assessmentScore: true,
        assessmentResult: true,
        hashValue: true,
        anchorTxHash: true,
        anchoredAt: true,
        createdAt: true
      }
    })
    res.json(jobs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/ocr/jobs/:id ─────────────────────────────────────────────────────
router.get('/jobs/:id', authenticate, async (req, res) => {
  try {
    const job = await prisma.ocrJob.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId }
    })
    if (!job) return res.status(404).json({ error: 'Job not found' })
    res.json(job)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/ocr/jobs/:id/pdf ─────────────────────────────────────────────────
router.get('/jobs/:id/pdf', authenticate, async (req, res) => {
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
