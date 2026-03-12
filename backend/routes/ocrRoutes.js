// backend/routes/ocrRoutes.js
const express = require('express')
const multer  = require('multer')
const crypto  = require('crypto')
const path    = require('path')
const router  = express.Router()
const prisma  = require('../lib/client')
const { can } = require('../middleware/permission')
const { extractText, uploadToS3 } = require('../services/ocrService')
const { normaliseDocument, assessDocument, crossAnalyseBundle } = require('../services/documentNormaliser')
const { generateOcrPdf, generateBundlePdf } = require('../services/ocrPdfService')
const { createAuditLog } = require('../services/auditService')
const { trackEvent, hasEvent } = require('../services/engagementService')
const { generateOcrFingerprint } = require('../lib/ocrFingerprint')
const { computePHashFromFile } = require('../lib/pHashService')
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
router.post('/process', can('documents:write'), upload.single('file'), async (req, res) => {
  const tenantId = req.user.tenantId
  const userId   = req.user.userId

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  logger.info({ tenantId, userId, filename: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype }, 'OCR process started')

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

    logger.info({ jobId: job.id }, 'OCR job record created')

    // Return immediately so the UI shows the job
    res.status(201).json({ data: job })

    // 2. Process in background (don't block response)
    processOcrJob(job.id, tenantId, userId, req.file).catch(err => {
      logger.error({ err: err.message, stack: err.stack, jobId: job.id }, 'OCR background processing failed')
    })

  } catch (err) {
    logger.error({ err: err.message, stack: err.stack, code: err.code, jobId: job?.id }, 'OCR upload/create failed')

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

    // 2b. Generate OCR text fingerprint
    const ocrFp = generateOcrFingerprint(ocrResult.rawText)

    await prisma.ocrJob.update({
      where: { id: jobId },
      data: { rawText: ocrResult.rawText, confidence: ocrResult.confidence, ocrFingerprint: ocrFp, status: 'normalising' }
    })

    if (ocrFp) {
      logger.info({ jobId, ocrFingerprint: ocrFp.slice(0, 16) }, 'OCR fingerprint generated')
    }

    // 2c. Generate pHash for visual duplicate detection
    const filePHash = await computePHashFromFile(file.buffer, file.mimetype).catch(() => null)
    if (filePHash) {
      await prisma.ocrJob.update({
        where: { id: jobId },
        data: { pHash: filePHash }
      })
      logger.info({ jobId, pHash: filePHash }, 'pHash generated')
    }

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

    // 9. Engagement tracking
    const isFirst = !(await hasEvent(tenantId, 'first_document'))
    if (isFirst) {
      trackEvent(tenantId, 'first_document', { jobId, filename: file.originalname }, userId).catch(() => {})
    }
    trackEvent(tenantId, 'daily_active', { action: 'ocr_processed' }, userId).catch(() => {})

  } catch (err) {
    logger.error({ err: err.message, stack: err.stack, jobId }, 'OCR pipeline error')
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
    logger.error({ err: err.message, stack: err.stack }, 'GET /api/ocr/jobs failed')
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
    logger.error({ err: err.message, stack: err.stack }, 'GET /api/ocr/jobs/:id failed')
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
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    })
    const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || 'tulipglobal.org'
    const url = await getSignedUrl(s3Client, new GetObjectCommand({
      Bucket: bucket,
      Key: job.normalisedPdfS3
    }), { expiresIn: 300 })

    res.json({ url })
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'GET /api/ocr/jobs/:id/pdf failed')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/ocr/bundle/process ──────────────────────────────────────────────
const uploadBundle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'application/pdf']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Unsupported file type. Use JPG, PNG, TIFF, WEBP, or PDF.'))
  }
}).array('files', 20)

router.post('/bundle/process', can('documents:write'), (req, res, next) => {
  uploadBundle(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    next()
  })
}, async (req, res) => {
  const tenantId = req.user.tenantId
  const userId = req.user.userId
  const bundleName = req.body.name || `Bundle ${new Date().toISOString().slice(0, 10)}`

  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' })
  if (req.files.length > 20) return res.status(400).json({ error: 'Maximum 20 files per bundle' })

  logger.info({ tenantId, userId, fileCount: req.files.length, bundleName }, 'Bundle process started')

  let bundle
  try {
    bundle = await prisma.bundleJob.create({
      data: {
        tenantId,
        name: bundleName,
        fileCount: req.files.length,
        status: 'processing'
      }
    })

    // Create OcrJob records for each file
    const ocrJobs = []
    for (const file of req.files) {
      const job = await prisma.ocrJob.create({
        data: {
          tenantId,
          originalFilename: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          s3Key: '',
          status: 'processing',
          bundleJobId: bundle.id
        }
      })
      ocrJobs.push({ job, file })
    }

    const bundleWithJobs = await prisma.bundleJob.findFirst({
      where: { id: bundle.id },
      include: { ocrJobs: true }
    })

    res.status(201).json({ data: bundleWithJobs })

    // Process in background
    processBundleJob(bundle.id, tenantId, userId, ocrJobs).catch(err => {
      logger.error({ err: err.message, stack: err.stack, bundleId: bundle.id }, 'Bundle background processing failed')
    })

  } catch (err) {
    logger.error({ err: err.message, stack: err.stack, bundleId: bundle?.id }, 'Bundle upload/create failed')
    if (bundle?.id) {
      await prisma.bundleJob.update({
        where: { id: bundle.id },
        data: { status: 'failed' }
      }).catch(() => {})
    }
    res.status(500).json({ error: 'Bundle processing failed', details: err.message })
  }
})

// Background bundle pipeline
async function processBundleJob(bundleId, tenantId, userId, ocrJobs) {
  const completedDocs = []

  try {
    // Process each document individually
    for (let i = 0; i < ocrJobs.length; i++) {
      const { job, file } = ocrJobs[i]

      try {
        // 1. Upload to S3
        const s3Key = `ocr/${tenantId}/${job.id}/original${path.extname(file.originalname)}`
        await uploadToS3(file.buffer, s3Key, file.mimetype)

        await prisma.ocrJob.update({
          where: { id: job.id },
          data: { s3Key, status: 'extracting' }
        })

        // 2. Extract text via Textract
        logger.info({ jobId: job.id, bundleId }, 'Bundle: extracting text')
        const ocrResult = await extractText(s3Key)

        const bundleFp = generateOcrFingerprint(ocrResult.rawText)

        const bundlePHash = await computePHashFromFile(file.buffer, file.mimetype).catch(() => null)

        await prisma.ocrJob.update({
          where: { id: job.id },
          data: { rawText: ocrResult.rawText, confidence: ocrResult.confidence, ocrFingerprint: bundleFp, pHash: bundlePHash, status: 'normalising' }
        })

        // 3. Normalise via Claude
        logger.info({ jobId: job.id, bundleId }, 'Bundle: normalising')
        const normalisedDoc = await normaliseDocument(
          ocrResult.rawText,
          ocrResult.keyValuePairs,
          ocrResult.tables,
          file.originalname
        )

        await prisma.ocrJob.update({
          where: { id: job.id },
          data: { documentType: normalisedDoc.documentType, detectedLanguage: normalisedDoc.detectedLanguage, normalisedJson: normalisedDoc, status: 'assessing' }
        })

        // 4. Assess via Claude
        logger.info({ jobId: job.id, bundleId }, 'Bundle: assessing')
        const assessment = await assessDocument(normalisedDoc, ocrResult.rawText)

        // 5. Generate individual PDF
        const pdfBuffer = await generateOcrPdf(normalisedDoc, assessment, job.id)
        const pdfS3Key = `ocr/${tenantId}/${job.id}/normalised.pdf`
        await uploadToS3(pdfBuffer, pdfS3Key, 'application/pdf')

        const hashValue = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

        await prisma.ocrJob.update({
          where: { id: job.id },
          data: {
            assessmentScore: assessment.riskScore,
            assessmentResult: assessment.riskLevel,
            assessmentNotes: assessment.summary,
            flags: assessment.flags || [],
            normalisedPdfS3: pdfS3Key,
            hashValue,
            status: 'completed'
          }
        })

        completedDocs.push({
          filename: file.originalname,
          normalised: normalisedDoc,
          assessment,
          jobId: job.id
        })

        // Update bundle progress
        await prisma.bundleJob.update({
          where: { id: bundleId },
          data: { completedCount: completedDocs.length, status: 'processing_docs' }
        })

      } catch (docErr) {
        logger.error({ err: docErr.message, stack: docErr.stack, jobId: job.id, bundleId }, 'Bundle: individual doc failed')
        await prisma.ocrJob.update({
          where: { id: job.id },
          data: { status: 'failed' }
        }).catch(() => {})
      }
    }

    if (completedDocs.length === 0) {
      throw new Error('All documents in bundle failed processing')
    }

    // 6. Cross-analysis via Claude
    logger.info({ bundleId, completedCount: completedDocs.length }, 'Bundle: starting cross-analysis')
    await prisma.bundleJob.update({
      where: { id: bundleId },
      data: { status: 'cross_analysing' }
    })

    const crossAnalysis = await crossAnalyseBundle(completedDocs, ocrJobs[0]?.file?.originalname ? `Bundle of ${completedDocs.length} documents` : 'Document Bundle')

    await prisma.bundleJob.update({
      where: { id: bundleId },
      data: {
        crossAnalysisJson: crossAnalysis,
        overallRiskScore: crossAnalysis.bundleRiskScore,
        overallRiskLevel: crossAnalysis.bundleRiskLevel,
        status: 'generating_report'
      }
    })

    // 7. Generate master report PDF
    logger.info({ bundleId }, 'Bundle: generating master report PDF')
    const masterPdf = await generateBundlePdf(
      ocrJobs[0]?.file?.originalname ? `Bundle — ${completedDocs.length} Documents` : 'Document Bundle',
      crossAnalysis,
      completedDocs,
      bundleId
    )
    const masterS3Key = `ocr/${tenantId}/${bundleId}/master-report.pdf`
    await uploadToS3(masterPdf, masterS3Key, 'application/pdf')

    const bundleHash = crypto.createHash('sha256').update(masterPdf).digest('hex')

    // 8. Mark complete
    await prisma.bundleJob.update({
      where: { id: bundleId },
      data: {
        status: 'completed',
        masterReportS3: masterS3Key,
        bundleHash,
      }
    })

    logger.info({ bundleId, bundleHash }, 'Bundle job completed')

    createAuditLog({
      action: 'ocr.bundle_processed',
      entityType: 'BundleJob',
      entityId: bundleId,
      userId,
      tenantId,
    }).catch(() => {})

    trackEvent(tenantId, 'bundle_processed', { bundleId, fileCount: ocrJobs.length }, userId).catch(() => {})

  } catch (err) {
    logger.error({ err: err.message, stack: err.stack, bundleId }, 'Bundle pipeline error')
    await prisma.bundleJob.update({
      where: { id: bundleId },
      data: { status: 'failed' }
    }).catch(() => {})
  }
}

// ── GET /api/ocr/bundles ──────────────────────────────────────────────────────
router.get('/bundles', can('documents:read'), async (req, res) => {
  try {
    const bundles = await prisma.bundleJob.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { ocrJobs: { select: { id: true, originalFilename: true, status: true, documentType: true, assessmentResult: true, assessmentScore: true } } }
    })
    res.json({ data: bundles, total: bundles.length })
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'GET /api/ocr/bundles failed')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/ocr/bundles/:id ──────────────────────────────────────────────────
router.get('/bundles/:id', can('documents:read'), async (req, res) => {
  try {
    const bundle = await prisma.bundleJob.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      include: { ocrJobs: true }
    })
    if (!bundle) return res.status(404).json({ error: 'Bundle not found' })
    res.json({ data: bundle })
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'GET /api/ocr/bundles/:id failed')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/ocr/bundles/:id/pdf ──────────────────────────────────────────────
router.get('/bundles/:id/pdf', can('documents:read'), async (req, res) => {
  try {
    const bundle = await prisma.bundleJob.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId }
    })
    if (!bundle || !bundle.masterReportS3) return res.status(404).json({ error: 'Report not found' })

    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    })
    const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || 'tulipglobal.org'
    const url = await getSignedUrl(s3Client, new GetObjectCommand({
      Bucket: bucket,
      Key: bundle.masterReportS3
    }), { expiresIn: 300 })

    res.json({ url })
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'GET /api/ocr/bundles/:id/pdf failed')
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
