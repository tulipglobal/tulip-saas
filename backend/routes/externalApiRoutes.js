// routes/externalApiRoutes.js
// External API endpoints authenticated via API key
// These mirror the internal OCR/Bundle endpoints but are for third-party integrations

const express = require('express')
const multer  = require('multer')
const crypto  = require('crypto')
const path    = require('path')
const router  = express.Router()
const prisma  = require('../lib/client')
const { extractText, uploadToS3 } = require('../services/ocrService')
const { normaliseDocument, assessDocument, crossAnalyseBundle } = require('../services/documentNormaliser')
const { generateOcrPdf, generateBundlePdf } = require('../services/ocrPdfService')
const { createAuditLog } = require('../services/auditService')
const logger  = require('../lib/logger')
const { autoIssueSeal } = require('../services/universalSealService')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'application/pdf']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Unsupported file type. Use JPG, PNG, TIFF, WEBP, or PDF.'))
  }
})

// ── POST /api/external/ocr/process ──────────────────────────────────────────
router.post('/ocr/process', (req, res, next) => {
  upload.single('document')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    next()
  })
}, async (req, res) => {
  const tenantId = req.user.tenantId
  const userId   = req.user.userId

  // Check permission (skip for JWT-authenticated dashboard users)
  if (req.user.authMethod === 'apikey' && !req.user.permissions?.includes('documents:write')) {
    return res.status(403).json({ error: 'API key lacks documents:write permission' })
  }

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  logger.info({ tenantId, userId, filename: req.file.originalname, authMethod: 'apikey' }, 'External OCR process started')

  let job
  try {
    job = await prisma.ocrJob.create({
      data: {
        tenantId,
        originalFilename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        s3Key: '',
        status: 'processing',
        apiKeyId: req.user.keyId,
      }
    })

    // Return job immediately — flat shape so frontend can read data.jobId directly
    res.status(201).json({ jobId: job.id, id: job.id, status: 'processing', message: 'OCR job created. Poll GET /api/external/ocr/jobs/:id for status.' })

    // Process in background
    processExternalOcrJob(job.id, tenantId, userId, req.file).catch(err => {
      logger.error({ err: err.message, stack: err.stack, jobId: job.id }, 'External OCR background failed')
    })

  } catch (err) {
    logger.error({ err: err.message, stack: err.stack, jobId: job?.id }, 'External OCR upload failed')
    if (job?.id) {
      await prisma.ocrJob.update({ where: { id: job.id }, data: { status: 'failed' } }).catch(() => {})
    }
    res.status(500).json({ error: 'OCR processing failed', details: err.message })
  }
})

async function processExternalOcrJob(jobId, tenantId, userId, file) {
  try {
    const s3Key = `ocr/${tenantId}/${jobId}/original${path.extname(file.originalname)}`
    await uploadToS3(file.buffer, s3Key, file.mimetype)
    await prisma.ocrJob.update({ where: { id: jobId }, data: { s3Key, status: 'extracting' } })

    const ocrResult = await extractText(s3Key)
    await prisma.ocrJob.update({ where: { id: jobId }, data: { rawText: ocrResult.rawText, confidence: ocrResult.confidence, status: 'normalising' } })

    const normalisedDoc = await normaliseDocument(ocrResult.rawText, ocrResult.keyValuePairs, ocrResult.tables, file.originalname)
    await prisma.ocrJob.update({ where: { id: jobId }, data: { documentType: normalisedDoc.documentType, detectedLanguage: normalisedDoc.detectedLanguage, normalisedJson: normalisedDoc, status: 'assessing' } })

    const assessment = await assessDocument(normalisedDoc, ocrResult.rawText)

    const pdfBuffer = await generateOcrPdf(normalisedDoc, assessment, jobId)
    const pdfS3Key = `ocr/${tenantId}/${jobId}/normalised.pdf`
    await uploadToS3(pdfBuffer, pdfS3Key, 'application/pdf')
    const hashValue = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

    await prisma.ocrJob.update({
      where: { id: jobId },
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

    // Also hash the original uploaded file for independent verification
    const originalHash = crypto.createHash('sha256').update(file.buffer).digest('hex')

    logger.info({ jobId, hashValue, originalHash }, 'External OCR job completed')

    // Auto-issue Trust Seal for processed document (non-blocking)
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
    const orgName = tenant?.name || 'Organization'
    autoIssueSeal({
      documentTitle: file.originalname,
      documentType: 'api-document',
      rawHash: hashValue,
      issuedBy: orgName,
      issuedTo: orgName,
      tenantId,
      fileKey: s3Key,
      fileType: file.mimetype,
      metadata: { source: 'external-api', jobId },
    }).catch(err => logger.error({ err: err.message }, '[seal] external OCR seal failed'))

    createAuditLog({
      action: 'ocr.external_processed',
      entityType: 'OcrJob',
      entityId: jobId,
      userId,
      tenantId,
      details: { hashValue, originalHash },
    }).catch(() => {})
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack, jobId }, 'External OCR pipeline error')
    await prisma.ocrJob.update({ where: { id: jobId }, data: { status: 'failed' } }).catch(() => {})
  }
}

// ── GET /api/external/ocr/jobs — list jobs for tenant ─────────────────────
router.get('/ocr/jobs', async (req, res) => {
  if (req.user.authMethod === 'apikey' && !req.user.permissions?.includes('documents:read')) {
    return res.status(403).json({ error: 'API key lacks documents:read permission' })
  }

  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100)
    const jobs = await prisma.ocrJob.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        originalFilename: true,
        status: true,
        documentType: true,
        assessmentScore: true,
        assessmentResult: true,
        normalisedJson: true,
        hashValue: true,
        anchorTxHash: true,
        anchoredAt: true,
        createdAt: true,
      },
    })

    // Resolve sealIds for completed jobs
    const hashes = jobs.filter(j => j.hashValue).map(j => j.hashValue)
    const seals = hashes.length > 0 ? await prisma.trustSeal.findMany({
      where: { rawHash: { in: hashes }, tenantId: req.user.tenantId },
      select: { id: true, rawHash: true },
    }) : []
    const sealMap = Object.fromEntries(seals.map(s => [s.rawHash, s.id]))

    res.json(jobs.map(job => ({
      id: job.id,
      fileName: job.originalFilename,
      status: job.status === 'pending' ? 'processing' : job.status,
      createdAt: job.createdAt,
      result: (job.status === 'completed') ? {
        documentType: job.documentType,
        riskScore: job.assessmentScore,
        riskLevel: job.assessmentResult,
        normalizedData: job.normalisedJson,
      } : undefined,
      hash: job.hashValue || undefined,
      sealId: job.hashValue ? sealMap[job.hashValue] || null : null,
      anchorStatus: job.anchorTxHash ? 'confirmed' : (job.status === 'completed' ? 'pending' : null),
    })))
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'External list jobs failed')
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/external/ocr/jobs/:id ──────────────────────────────────────────
router.get('/ocr/jobs/:id', async (req, res) => {
  if (req.user.authMethod === 'apikey' && !req.user.permissions?.includes('documents:read')) {
    return res.status(403).json({ error: 'API key lacks documents:read permission' })
  }

  try {
    const job = await prisma.ocrJob.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId }
    })
    if (!job) return res.status(404).json({ error: 'Job not found' })
    // Flat response — frontend reads data.status, data.result directly
    const response = {
      id: job.id,
      status: job.status,
      result: job.status === 'completed' ? {
        documentType: job.documentType,
        riskScore: job.assessmentScore,
        riskLevel: job.assessmentResult,
        normalizedData: job.normalisedJson,
      } : undefined,
      error: job.status === 'failed' ? 'Processing failed' : undefined,
    }
    // Include hash and blockchain info when available
    if (job.hashValue) {
      response.hash = job.hashValue
      response.verifyUrl = `https://verify.tulipds.com/verify?hash=${job.hashValue}`
      // Resolve sealId
      const seal = await prisma.trustSeal.findFirst({
        where: { rawHash: job.hashValue, tenantId: req.user.tenantId },
        select: { id: true },
      })
      if (seal) response.sealId = seal.id
    }
    response.anchorStatus = job.anchorTxHash ? 'confirmed' : (job.status === 'completed' ? 'pending' : null)
    if (job.anchorTxHash) {
      response.blockchain = {
        network: 'Polygon',
        txHash: job.anchorTxHash,
        anchoredAt: job.anchoredAt,
      }
    }
    res.json(response)
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'External GET job failed')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/external/ocr/bundle ───────────────────────────────────────────
const uploadBundleExt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'application/pdf']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Unsupported file type.'))
  }
}).array('files', 20)

router.post('/ocr/bundle', (req, res, next) => {
  uploadBundleExt(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    next()
  })
}, async (req, res) => {
  if (req.user.authMethod === 'apikey' && !req.user.permissions?.includes('documents:write')) {
    return res.status(403).json({ error: 'API key lacks documents:write permission' })
  }

  const tenantId = req.user.tenantId
  const userId = req.user.userId
  const bundleName = req.body.name || `API Bundle ${new Date().toISOString().slice(0, 10)}`

  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' })
  if (req.files.length > 20) return res.status(400).json({ error: 'Maximum 20 files per bundle' })

  let bundle
  try {
    bundle = await prisma.bundleJob.create({
      data: { tenantId, name: bundleName, fileCount: req.files.length, status: 'processing' }
    })

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
          bundleJobId: bundle.id,
          apiKeyId: req.user.keyId,
        }
      })
      ocrJobs.push({ job, file })
    }

    res.status(201).json({ data: { id: bundle.id, status: 'processing', fileCount: req.files.length }, message: 'Bundle created. Poll GET /api/external/ocr/bundles/:id for status.' })

    // Reuse the bundle processing from ocrRoutes — import not needed, just inline the same logic
    processExternalBundle(bundle.id, tenantId, userId, ocrJobs).catch(err => {
      logger.error({ err: err.message, stack: err.stack, bundleId: bundle.id }, 'External bundle processing failed')
    })

  } catch (err) {
    logger.error({ err: err.message, stack: err.stack, bundleId: bundle?.id }, 'External bundle create failed')
    if (bundle?.id) {
      await prisma.bundleJob.update({ where: { id: bundle.id }, data: { status: 'failed' } }).catch(() => {})
    }
    res.status(500).json({ error: 'Bundle processing failed', details: err.message })
  }
})

async function processExternalBundle(bundleId, tenantId, userId, ocrJobs) {
  const completedDocs = []
  try {
    for (const { job, file } of ocrJobs) {
      try {
        const s3Key = `ocr/${tenantId}/${job.id}/original${path.extname(file.originalname)}`
        await uploadToS3(file.buffer, s3Key, file.mimetype)
        await prisma.ocrJob.update({ where: { id: job.id }, data: { s3Key, status: 'extracting' } })

        const ocrResult = await extractText(s3Key)
        await prisma.ocrJob.update({ where: { id: job.id }, data: { rawText: ocrResult.rawText, confidence: ocrResult.confidence, status: 'normalising' } })

        const normalisedDoc = await normaliseDocument(ocrResult.rawText, ocrResult.keyValuePairs, ocrResult.tables, file.originalname)
        await prisma.ocrJob.update({ where: { id: job.id }, data: { documentType: normalisedDoc.documentType, detectedLanguage: normalisedDoc.detectedLanguage, normalisedJson: normalisedDoc, status: 'assessing' } })

        const assessment = await assessDocument(normalisedDoc, ocrResult.rawText)
        const pdfBuffer = await generateOcrPdf(normalisedDoc, assessment, job.id)
        const pdfS3Key = `ocr/${tenantId}/${job.id}/normalised.pdf`
        await uploadToS3(pdfBuffer, pdfS3Key, 'application/pdf')
        const hashValue = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

        await prisma.ocrJob.update({
          where: { id: job.id },
          data: { assessmentScore: assessment.riskScore, assessmentResult: assessment.riskLevel, assessmentNotes: assessment.summary, flags: assessment.flags || [], normalisedPdfS3: pdfS3Key, hashValue, status: 'completed' }
        })

        completedDocs.push({ filename: file.originalname, normalised: normalisedDoc, assessment, jobId: job.id })
        await prisma.bundleJob.update({ where: { id: bundleId }, data: { completedCount: completedDocs.length, status: 'processing_docs' } })
      } catch (docErr) {
        logger.error({ err: docErr.message, stack: docErr.stack, jobId: job.id, bundleId }, 'External bundle: doc failed')
        await prisma.ocrJob.update({ where: { id: job.id }, data: { status: 'failed' } }).catch(() => {})
      }
    }

    if (completedDocs.length === 0) throw new Error('All documents failed')

    await prisma.bundleJob.update({ where: { id: bundleId }, data: { status: 'cross_analysing' } })
    const crossAnalysis = await crossAnalyseBundle(completedDocs, `Bundle of ${completedDocs.length} documents`)

    await prisma.bundleJob.update({
      where: { id: bundleId },
      data: { crossAnalysisJson: crossAnalysis, overallRiskScore: crossAnalysis.bundleRiskScore, overallRiskLevel: crossAnalysis.bundleRiskLevel, status: 'generating_report' }
    })

    const masterPdf = await generateBundlePdf(`Bundle — ${completedDocs.length} Documents`, crossAnalysis, completedDocs, bundleId)
    const masterS3Key = `ocr/${tenantId}/${bundleId}/master-report.pdf`
    await uploadToS3(masterPdf, masterS3Key, 'application/pdf')
    const bundleHash = crypto.createHash('sha256').update(masterPdf).digest('hex')

    await prisma.bundleJob.update({
      where: { id: bundleId },
      data: { status: 'completed', masterReportS3: masterS3Key, bundleHash }
    })

    logger.info({ bundleId, bundleHash }, 'External bundle completed')

    // Auto-issue Trust Seal for bundle (non-blocking)
    const bTenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
    const bOrgName = bTenant?.name || 'Organization'
    autoIssueSeal({
      documentTitle: `Bundle Report — ${completedDocs.length} Documents`,
      documentType: 'bundle',
      rawHash: bundleHash,
      issuedBy: bOrgName,
      issuedTo: bOrgName,
      tenantId,
      fileKey: masterS3Key,
      fileType: 'pdf',
      metadata: { source: 'external-api-bundle', bundleId },
    }).catch(err => logger.error({ err: err.message }, '[seal] bundle seal failed'))

    createAuditLog({ action: 'ocr.external_bundle_processed', entityType: 'BundleJob', entityId: bundleId, userId, tenantId }).catch(() => {})
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack, bundleId }, 'External bundle pipeline error')
    await prisma.bundleJob.update({ where: { id: bundleId }, data: { status: 'failed' } }).catch(() => {})
  }
}

// ── GET /api/external/ocr/bundles/:id ───────────────────────────────────────
router.get('/ocr/bundles/:id', async (req, res) => {
  if (req.user.authMethod === 'apikey' && !req.user.permissions?.includes('documents:read')) {
    return res.status(403).json({ error: 'API key lacks documents:read permission' })
  }

  try {
    const bundle = await prisma.bundleJob.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      include: { ocrJobs: true }
    })
    if (!bundle) return res.status(404).json({ error: 'Bundle not found' })
    res.json({ data: bundle })
  } catch (err) {
    logger.error({ err: err.message, stack: err.stack }, 'External GET bundle failed')
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
